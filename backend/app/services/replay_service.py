from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import settings
from app.schemas import ReplayAnalytics, ReplayDeleteResponse, ReplayDetail, ReplaySummary


def save_replay(name: str, payload: dict) -> Path:
    filename = f"{name.replace(' ', '-').lower()}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.json"
    path = _replay_dir() / filename
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path


def list_replays() -> list[ReplaySummary]:
    summaries: list[ReplaySummary] = []
    for path in _replay_files():
        frames = _read_replay_frames(path)
        summaries.append(_summary(path, frames))
    return sorted(summaries, key=lambda replay: replay.created_at, reverse=True)


def get_replay(replay_id: str) -> ReplayDetail:
    path = _resolve_replay_path(replay_id)
    frames = _read_replay_frames(path)
    summary = _summary(path, frames)
    return ReplayDetail(**summary.model_dump(), frames=frames)


def delete_replay(replay_id: str) -> ReplayDeleteResponse:
    path = _resolve_replay_path(replay_id)
    path.unlink()
    return ReplayDeleteResponse(replay_id=replay_id, deleted=True, message="Replay deleted")


def _replay_dir() -> Path:
    replay_dir = settings.data_dir / "replays"
    replay_dir.mkdir(parents=True, exist_ok=True)
    return replay_dir


def _replay_files() -> list[Path]:
    replay_dir = _replay_dir()
    return sorted([*replay_dir.glob("*.jsonl"), *replay_dir.glob("*.json")])


def _resolve_replay_path(replay_id: str) -> Path:
    safe_id = replay_id.replace("/", "").replace("\\", "")
    replay_dir = _replay_dir().resolve()
    candidates = [
        replay_dir / safe_id,
        replay_dir / f"{safe_id}.jsonl",
        replay_dir / f"{safe_id}.json",
    ]
    for candidate in candidates:
        resolved = candidate.resolve()
        if replay_dir in resolved.parents or resolved == replay_dir:
            if resolved.exists() and resolved.is_file() and resolved.suffix in {".jsonl", ".json"}:
                return resolved
    raise FileNotFoundError(replay_id)


def _read_replay_frames(path: Path) -> list[dict[str, Any]]:
    if path.suffix == ".jsonl":
        frames: list[dict[str, Any]] = []
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    frame = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if isinstance(frame, dict) and "frame_id" in frame:
                    frames.append(frame)
        return frames

    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return [frame for frame in payload if isinstance(frame, dict)]
    if isinstance(payload, dict):
        frames = payload.get("frames")
        if isinstance(frames, list):
            return [frame for frame in frames if isinstance(frame, dict)]
        if "frame_id" in payload:
            return [payload]
    return []


def _summary(path: Path, frames: list[dict[str, Any]]) -> ReplaySummary:
    stat = path.stat()
    created_at = _created_at(path, frames)
    return ReplaySummary(
        replay_id=path.stem,
        filename=path.name,
        created_at=created_at,
        size_bytes=stat.st_size,
        frame_count=len(frames),
        analytics=_analytics(frames),
    )


def _created_at(path: Path, frames: list[dict[str, Any]]) -> str:
    for frame in frames:
        timestamp = frame.get("timestamp")
        if isinstance(timestamp, str) and timestamp:
            return timestamp
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()


def _analytics(frames: list[dict[str, Any]]) -> ReplayAnalytics:
    total_detections = 0
    max_confidence = 0.0
    alert_count = 0
    class_distribution: dict[str, int] = {}
    track_ages: dict[str, int] = {}

    for frame in frames:
        detections = frame.get("detections") if isinstance(frame.get("detections"), list) else []
        tracks = frame.get("tracks") if isinstance(frame.get("tracks"), list) else []
        alerts = frame.get("alerts") if isinstance(frame.get("alerts"), list) else []
        total_detections += len(detections)
        alert_count += len(alerts)

        for detection in detections:
            if not isinstance(detection, dict):
                continue
            confidence = _float(detection.get("confidence"))
            max_confidence = max(max_confidence, confidence)
            label = str(detection.get("classification") or "unknown")
            class_distribution[label] = class_distribution.get(label, 0) + 1

        for track in tracks:
            if not isinstance(track, dict):
                continue
            confidence = _float(track.get("confidence"))
            max_confidence = max(max_confidence, confidence)
            track_id = str(track.get("track_id", "unknown"))
            track_ages[track_id] = max(track_ages.get(track_id, 0), int(_float(track.get("age"))))

    return ReplayAnalytics(
        total_frames=len(frames),
        total_detections=total_detections,
        max_confidence=round(max_confidence, 4),
        number_of_alerts=alert_count,
        longest_track_duration=max(track_ages.values(), default=0),
        predicted_class_distribution=dict(sorted(class_distribution.items())),
    )


def _float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0
