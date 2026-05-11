import json
from datetime import datetime, timezone
from pathlib import Path

from app.config import settings


def save_replay(name: str, payload: dict) -> Path:
    filename = f"{name.replace(' ', '-').lower()}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.json"
    path = settings.data_dir / "replays" / filename
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path


def list_replays() -> list[str]:
    replay_dir = settings.data_dir / "replays"
    replay_dir.mkdir(parents=True, exist_ok=True)
    return sorted(path.name for path in replay_dir.glob("*.json"))
