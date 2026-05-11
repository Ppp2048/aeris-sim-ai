from __future__ import annotations

import json
import random
import struct
import zlib
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import numpy as np

from app.config import settings
from app.database import get_connection
from app.models import SceneObject
from app.schemas import (
    DatasetRequest,
    DatasetResponse,
    SyntheticDatasetGenerateRequest,
    SyntheticDatasetSummary,
    SyntheticSampleResponse,
)
from app.services.range_doppler import build_range_doppler


DATASET_CLASSES = ("drone", "bird", "vehicle", "human", "clutter")


def generate_dataset(payload: DatasetRequest) -> DatasetResponse:
    samples_per_class = max(1, payload.samples // len(DATASET_CLASSES))
    result = generate_synthetic_dataset(
        SyntheticDatasetGenerateRequest(name=payload.name, samples_per_class=samples_per_class)
    )
    with get_connection() as conn:
        row = conn.execute("SELECT id FROM datasets WHERE path = ?", (result.path,)).fetchone()
    return DatasetResponse(
        id=int(row["id"]) if row else 0,
        name=result.name,
        sample_count=result.total_samples,
        path=result.path,
    )


def generate_synthetic_dataset(payload: SyntheticDatasetGenerateRequest) -> SyntheticDatasetSummary:
    created_at = datetime.now(timezone.utc).isoformat()
    dataset_id = f"ds_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid4().hex[:8]}"
    dataset_dir = settings.data_dir / "datasets" / dataset_id
    samples_dir = dataset_dir / "samples"
    previews_dir = dataset_dir / "previews"
    samples_dir.mkdir(parents=True, exist_ok=True)
    previews_dir.mkdir(parents=True, exist_ok=True)

    class_counts = _resolve_class_counts(payload)
    sample_records: list[dict] = []
    sample_id = 1
    rng = random.Random(dataset_id)

    for class_label, count in class_counts.items():
        for _ in range(count):
            sample_metadata = _sample_metadata(sample_id, class_label, payload, rng)
            heatmap = _sample_heatmap(sample_metadata, payload, rng)
            sample_name = f"sample_{sample_id:05d}"
            npy_path = samples_dir / f"{sample_name}.npy"
            json_path = samples_dir / f"{sample_name}.json"
            preview_path = previews_dir / f"{sample_name}.png"

            np.save(npy_path, heatmap.astype(np.float32))
            _write_png_preview(heatmap, preview_path)

            sample_payload = {
                **sample_metadata,
                "sample_id": sample_id,
                "npy_path": str(npy_path),
                "metadata_path": str(json_path),
                "preview_png_path": str(preview_path),
                "heatmap_shape": list(heatmap.shape),
            }
            json_path.write_text(json.dumps(sample_payload, indent=2), encoding="utf-8")
            sample_records.append(sample_payload)
            sample_id += 1

    metadata = {
        "dataset_id": dataset_id,
        "name": payload.name,
        "created_at": created_at,
        "classes": list(class_counts.keys()),
        "samples_per_class": class_counts,
        "total_samples": len(sample_records),
        "range_bins": payload.range_bins,
        "doppler_bins": payload.doppler_bins,
        "radar_range_m": payload.radar_range_m,
        "max_velocity_mps": payload.max_velocity_mps,
        "noise_level": payload.noise_level,
        "clutter_level": payload.clutter_level,
        "samples": sample_records,
    }
    (dataset_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    with get_connection() as conn:
        conn.execute(
            "INSERT INTO datasets (name, sample_count, path) VALUES (?, ?, ?)",
            (payload.name, len(sample_records), str(dataset_dir)),
        )

    return _summary_from_metadata(metadata, dataset_dir)


def list_synthetic_datasets() -> list[SyntheticDatasetSummary]:
    dataset_root = settings.data_dir / "datasets"
    dataset_root.mkdir(parents=True, exist_ok=True)
    summaries: list[SyntheticDatasetSummary] = []
    for metadata_path in sorted(dataset_root.glob("*/metadata.json"), reverse=True):
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        summaries.append(_summary_from_metadata(metadata, metadata_path.parent))
    return summaries


def get_synthetic_dataset(dataset_id: str) -> dict:
    metadata_path = _dataset_dir(dataset_id) / "metadata.json"
    if not metadata_path.exists():
        raise FileNotFoundError(dataset_id)
    return json.loads(metadata_path.read_text(encoding="utf-8"))


def get_synthetic_sample(dataset_id: str, sample_id: int) -> SyntheticSampleResponse:
    dataset_dir = _dataset_dir(dataset_id)
    sample_name = f"sample_{sample_id:05d}"
    json_path = dataset_dir / "samples" / f"{sample_name}.json"
    npy_path = dataset_dir / "samples" / f"{sample_name}.npy"
    if not json_path.exists() or not npy_path.exists():
        raise FileNotFoundError(f"{dataset_id}/{sample_id}")

    metadata = json.loads(json_path.read_text(encoding="utf-8"))
    heatmap = np.load(npy_path)
    preview = _downsample_for_response(heatmap, target_size=32)
    return SyntheticSampleResponse(
        dataset_id=dataset_id,
        sample_id=sample_id,
        metadata={
            "class_label": metadata["class_label"],
            "range_m": metadata["range_m"],
            "velocity_mps": metadata["velocity_mps"],
            "angle_deg": metadata["angle_deg"],
            "rcs": metadata["rcs"],
            "noise_level": metadata["noise_level"],
            "clutter_level": metadata["clutter_level"],
        },
        heatmap_shape=list(heatmap.shape),
        heatmap_preview=np.round(preview, 4).tolist(),
        npy_path=str(npy_path),
        preview_png_path=metadata.get("preview_png_path"),
    )


def _resolve_class_counts(payload: SyntheticDatasetGenerateRequest) -> dict[str, int]:
    class_counts: dict[str, int] = {}
    for class_label in payload.classes:
        if class_label not in DATASET_CLASSES:
            continue
        class_counts[class_label] = payload.class_counts.get(class_label, payload.samples_per_class) if payload.class_counts else payload.samples_per_class
    return class_counts or {class_label: payload.samples_per_class for class_label in DATASET_CLASSES}


def _sample_metadata(
    sample_id: int,
    class_label: str,
    payload: SyntheticDatasetGenerateRequest,
    rng: random.Random,
) -> dict[str, float | int | str]:
    profile = {
        "drone": (850, 22, 12, 110),
        "bird": (620, 10, 5, 55),
        "vehicle": (1250, 32, 32, 0),
        "human": (430, 3, 6, 1.7),
        "clutter": (260, 0.5, 3, 0),
    }[class_label]
    range_m = max(20.0, min(payload.radar_range_m, rng.gauss(profile[0], profile[0] * 0.22)))
    velocity_mps = max(-payload.max_velocity_mps, min(payload.max_velocity_mps, rng.gauss(profile[1], max(abs(profile[1]) * 0.35, 2))))
    if rng.random() < 0.35:
        velocity_mps *= -1
    return {
        "sample_id": sample_id,
        "class_label": class_label,
        "range_m": round(range_m, 3),
        "velocity_mps": round(velocity_mps, 3),
        "angle_deg": round(rng.uniform(-60, 60), 3),
        "rcs": round(max(0.5, rng.gauss(profile[2], max(profile[2] * 0.25, 1))), 3),
        "altitude_m": round(max(0, rng.gauss(profile[3], max(profile[3] * 0.25, 1))), 3),
        "heading_deg": round(rng.uniform(0, 359), 3),
        "noise_level": round(max(0, rng.gauss(payload.noise_level, 0.015)), 4),
        "clutter_level": round(max(0, rng.gauss(payload.clutter_level, 0.01)), 4),
    }


def _sample_heatmap(
    metadata: dict[str, float | int | str],
    payload: SyntheticDatasetGenerateRequest,
    rng: random.Random,
) -> np.ndarray:
    class_label = str(metadata["class_label"])
    target = SceneObject(
        id=int(metadata["sample_id"]),
        label=class_label,  # type: ignore[arg-type]
        range_m=float(metadata["range_m"]),
        velocity_mps=float(metadata["velocity_mps"]),
        angle_deg=float(metadata["angle_deg"]),
        rcs=float(metadata["rcs"]),
        altitude_m=float(metadata["altitude_m"]),
        heading_deg=float(metadata["heading_deg"]),
    )
    clutter_boost = 2.0 if class_label == "clutter" else 1.0
    heatmap, _range_axis, _velocity_axis = build_range_doppler(
        targets=[target],
        range_bins=payload.range_bins,
        doppler_bins=payload.doppler_bins,
        noise_floor=float(metadata["noise_level"]),
        clutter_density=min(float(metadata["clutter_level"]) * clutter_boost, 0.5),
        max_range_m=payload.radar_range_m,
        max_abs_velocity_mps=payload.max_velocity_mps,
        seed=rng.randint(1, 10_000_000),
    )
    return heatmap


def _write_png_preview(heatmap: np.ndarray, path: Path) -> None:
    image = np.clip(heatmap * 255, 0, 255).astype(np.uint8)
    height, width = image.shape
    raw_rows = b"".join(b"\x00" + image[row].tobytes() for row in range(height))

    def chunk(chunk_type: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + chunk_type
            + data
            + struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
        )

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw_rows, level=6))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def _downsample_for_response(heatmap: np.ndarray, target_size: int) -> np.ndarray:
    rows, cols = heatmap.shape
    row_factor = max(rows // target_size, 1)
    col_factor = max(cols // target_size, 1)
    out_rows = min(target_size, rows // row_factor)
    out_cols = min(target_size, cols // col_factor)
    trimmed = heatmap[: out_rows * row_factor, : out_cols * col_factor]
    return trimmed.reshape(out_rows, row_factor, out_cols, col_factor).mean(axis=(1, 3))


def _summary_from_metadata(metadata: dict, dataset_dir: Path) -> SyntheticDatasetSummary:
    return SyntheticDatasetSummary(
        dataset_id=metadata["dataset_id"],
        name=metadata["name"],
        created_at=metadata["created_at"],
        classes=metadata["classes"],
        total_samples=int(metadata["total_samples"]),
        samples_per_class=metadata["samples_per_class"],
        path=str(dataset_dir),
    )


def _dataset_dir(dataset_id: str) -> Path:
    return settings.data_dir / "datasets" / dataset_id
