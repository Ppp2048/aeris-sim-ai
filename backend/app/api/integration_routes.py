from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import numpy as np
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import settings
from app.custom_integrations.model_registry import model_registry
from app.custom_integrations.parser_registry import parser_registry
from app.schemas import (
    IntegrationParseRequest,
    IntegrationParseResponse,
    IntegrationUploadResponse,
    ModelAdapterRequest,
    ModelAdapterResponse,
    ParserInfo,
)


router = APIRouter()

ACCEPTED_FORMATS = [".csv"]
MATRIX_COLUMN_NAMES = {"matrix", "heatmap", "range_doppler", "range_doppler_matrix"}


@router.post("/upload-data", response_model=IntegrationUploadResponse)
async def upload_data(file: UploadFile = File(...)) -> IntegrationUploadResponse:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ACCEPTED_FORMATS:
        raise HTTPException(status_code=400, detail=f"Unsupported format. Accepted formats: {', '.join(ACCEPTED_FORMATS)}")

    uploads_dir = _integration_dir("uploads")
    file_id = f"radar_csv_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid4().hex[:8]}"
    path = uploads_dir / f"{file_id}{suffix}"
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    path.write_bytes(content)

    rows, columns = _read_csv(path)
    warnings = _upload_warnings(rows, columns)
    return IntegrationUploadResponse(
        file_id=file_id,
        filename=file.filename or path.name,
        path=str(path),
        columns=columns,
        row_count=len(rows),
        preview_rows=rows[:25],
        accepted_formats=ACCEPTED_FORMATS,
        warnings=warnings,
    )


@router.post("/parse", response_model=IntegrationParseResponse)
def parse_data(payload: IntegrationParseRequest) -> IntegrationParseResponse:
    path = _uploaded_file_path(payload.file_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Uploaded data file not found: {payload.file_id}")
    if payload.parser_name not in {parser.name for parser in parser_registry.list_parsers()}:
        raise HTTPException(status_code=400, detail=f"Unknown parser: {payload.parser_name}")

    rows, columns = _read_csv(path)
    mapping = payload.column_mapping.model_dump()
    missing = [target for target, source in mapping.items() if source and source not in columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Mapped columns not found in CSV: {', '.join(missing)}")

    mapped_rows: list[dict[str, float | str | None]] = []
    warnings: list[str] = []
    for row_index, row in enumerate(rows):
        mapped = _map_row(row, mapping, row_index, warnings)
        mapped_rows.append(mapped)

    if not mapping.get("range_m") or not mapping.get("velocity_mps"):
        warnings.append("Range and velocity mappings are recommended for heatmap preview generation.")
    if not mapping.get("amplitude"):
        warnings.append("Amplitude mapping is missing; heatmap preview will use unit amplitude.")

    heatmap = _heatmap_from_rows(mapped_rows) if mapping.get("range_m") and mapping.get("velocity_mps") else None
    return IntegrationParseResponse(
        file_id=payload.file_id,
        parser_name=payload.parser_name,
        mapped_rows=mapped_rows[:100],
        row_count=len(mapped_rows),
        heatmap_preview=heatmap,
        warnings=warnings[:50],
    )


@router.get("/parsers", response_model=list[ParserInfo])
def parsers() -> list[ParserInfo]:
    return parser_registry.list_parsers()


@router.post("/upload-model-metadata", response_model=ModelAdapterResponse)
def upload_model_metadata(payload: ModelAdapterRequest) -> ModelAdapterResponse:
    adapters_dir = _integration_dir("model_adapters")
    adapter_id = f"adapter_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid4().hex[:8]}"
    created_at = datetime.now(timezone.utc).isoformat()
    record = {
        "adapter_id": adapter_id,
        "model_name": payload.model_name,
        "model_type": payload.model_type,
        "expected_input_shape": payload.expected_input_shape,
        "classes": payload.classes,
        "notes": payload.notes,
        "created_at": created_at,
        "path": str(adapters_dir / f"{adapter_id}.json"),
    }
    Path(record["path"]).write_text(json.dumps(record, indent=2), encoding="utf-8")
    return ModelAdapterResponse(**record)


@router.get("/model-adapters", response_model=list[ModelAdapterResponse])
def model_adapters() -> list[ModelAdapterResponse]:
    adapters_dir = _integration_dir("model_adapters")
    adapters: list[ModelAdapterResponse] = []
    for path in sorted(adapters_dir.glob("*.json"), reverse=True):
        try:
            adapters.append(ModelAdapterResponse(**json.loads(path.read_text(encoding="utf-8"))))
        except (OSError, json.JSONDecodeError, TypeError):
            continue
    return sorted(adapters, key=lambda adapter: adapter.created_at, reverse=True)


@router.get("/models")
def models() -> dict[str, list[str]]:
    return {"models": model_registry.list_models()}


def _integration_dir(name: str) -> Path:
    path = settings.data_dir / "integrations" / name
    path.mkdir(parents=True, exist_ok=True)
    return path


def _uploaded_file_path(file_id: str) -> Path:
    uploads = _integration_dir("uploads")
    matches = list(uploads.glob(f"{file_id}.*"))
    return matches[0] if matches else uploads / f"{file_id}.csv"


def _read_csv(path: Path) -> tuple[list[dict[str, str]], list[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        columns = list(reader.fieldnames or [])
        if not columns:
            raise HTTPException(status_code=400, detail="CSV must contain a header row.")
        rows = [{key: value for key, value in row.items() if key is not None} for row in reader]
    return rows, columns


def _upload_warnings(rows: list[dict[str, str]], columns: list[str]) -> list[str]:
    warnings: list[str] = []
    if not rows:
        warnings.append("CSV has headers but no data rows.")
    lower_columns = {column.lower() for column in columns}
    if not {"range_m", "velocity_mps"}.issubset(lower_columns):
        warnings.append("Could not auto-detect both range_m and velocity_mps columns.")
    if lower_columns & MATRIX_COLUMN_NAMES:
        warnings.append("Matrix-like column detected; use parser mapping to preview heatmap data.")
    return warnings


def _map_row(row: dict[str, str], mapping: dict[str, str | None], row_index: int, warnings: list[str]) -> dict[str, float | str | None]:
    mapped: dict[str, float | str | None] = {}
    for target, source in mapping.items():
        raw_value = row.get(source or "", "") if source else ""
        if target in {"timestamp", "class_label"}:
            mapped[target] = raw_value or None
            continue
        if raw_value == "":
            mapped[target] = None
            continue
        try:
            mapped[target] = float(raw_value)
        except ValueError:
            mapped[target] = None
            if len(warnings) < 25:
                warnings.append(f"Row {row_index + 1}: value '{raw_value}' in {source} could not be parsed as a number.")
    return mapped


def _heatmap_from_rows(rows: list[dict[str, float | str | None]], bins: int = 48) -> list[list[float]]:
    numeric = [
        (
            float(row["range_m"]),
            float(row["velocity_mps"]),
            float(row.get("amplitude") or 1.0),
        )
        for row in rows
        if isinstance(row.get("range_m"), (float, int)) and isinstance(row.get("velocity_mps"), (float, int))
    ]
    if not numeric:
        return [[0.0 for _ in range(bins)] for _ in range(bins)]

    ranges = np.array([item[0] for item in numeric], dtype=float)
    velocities = np.array([item[1] for item in numeric], dtype=float)
    amplitudes = np.array([max(item[2], 0.0) for item in numeric], dtype=float)
    range_span = max(float(ranges.max() - ranges.min()), 1.0)
    velocity_span = max(float(velocities.max() - velocities.min()), 1.0)
    heatmap = np.zeros((bins, bins), dtype=float)
    for range_m, velocity_mps, amplitude in numeric:
        r_bin = min(bins - 1, max(0, int(((range_m - ranges.min()) / range_span) * (bins - 1))))
        v_bin = min(bins - 1, max(0, int(((velocity_mps - velocities.min()) / velocity_span) * (bins - 1))))
        heatmap[v_bin, r_bin] += amplitude
    max_value = float(heatmap.max(initial=0.0))
    if max_value > 0:
        heatmap = heatmap / max_value
    return np.round(heatmap, 4).tolist()
