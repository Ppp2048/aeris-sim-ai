from __future__ import annotations

import json
import time
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock

import numpy as np

from app.config import settings
from app.models import CfarDetection, SceneObject, TrackReport
from app.schemas import SceneConfig, SceneObjectConfig
from app.services.classifier import classifier_service
from app.services.kalman_tracker import TrackerBank
from app.services.radar_simulator import generate_scene, simulate_frame


RESTRICTED_ZONE_RANGE_M = 300.0


class SimulationManager:
    def __init__(self) -> None:
        self._lock = RLock()
        self.running = False
        self.frame_id = 0
        self.scene_config = self._default_scene_config()
        self.objects = self._objects_from_config(self.scene_config)
        self.tracker = TrackerBank()
        self.current_frame: dict | None = None
        self.replay_path: Path | None = None
        self._started_at = time.perf_counter()
        self._last_frame_at = time.perf_counter()

    def start(self) -> dict:
        with self._lock:
            self.running = True
            self._started_at = time.perf_counter()
            self._last_frame_at = self._started_at
            self.replay_path = self._new_replay_path()
            return self._control_response("simulation started")

    def stop(self) -> dict:
        with self._lock:
            self.running = False
            return self._control_response("simulation stopped")

    def status(self) -> dict:
        with self._lock:
            stats = self.current_frame["stats"] if self.current_frame else self._stats([], [])
            return {
                "running": self.running,
                "frame_id": self.frame_id,
                "frame_rate": self.scene_config.frame_rate,
                "object_count": len(self.objects),
                "replay_path": str(self.replay_path) if self.replay_path else None,
                "stats": stats,
            }

    def set_scene(self, config: SceneConfig) -> dict:
        with self._lock:
            self.scene_config = config
            self.objects = self._objects_from_config(config)
            self.tracker.reset()
            self.frame_id = 0
            self.current_frame = None
            return {
                "running": self.running,
                "frame_id": self.frame_id,
                "replay_path": str(self.replay_path) if self.replay_path else None,
                "message": f"scene updated with {len(self.objects)} objects",
            }

    def step(self, websocket: bool = False) -> dict:
        with self._lock:
            now = time.perf_counter()
            simulated_fps = 1.0 / max(now - self._last_frame_at, 1e-6)
            self._last_frame_at = now
            self.frame_id += 1
            self.objects = self._advance_objects(self.objects, self.scene_config)

            heatmap, _range_axis, _velocity_axis, detections, tracks = simulate_frame(
                scene=self.objects,
                range_bins=128,
                doppler_bins=128,
                noise_floor=self.scene_config.noise_level,
                clutter_density=self.scene_config.clutter_level,
                max_range_m=self.scene_config.radar_range_m,
                max_abs_velocity_mps=self.scene_config.max_velocity_mps,
                threshold_scale=self.scene_config.cfar_threshold_scale,
                guard_cells=self.scene_config.guard_cells,
                training_cells=self.scene_config.training_cells,
                tracker=self.tracker,
                seed=self.frame_id,
            )
            frame = self._frame_payload(heatmap, detections, tracks, simulated_fps, downsample=websocket)
            self.current_frame = frame if not websocket else self._frame_payload(heatmap, detections, tracks, simulated_fps)
            self._append_replay(self.current_frame)
            return frame

    def get_current_frame(self) -> dict:
        with self._lock:
            if self.current_frame is None:
                return self.step()
            return self.current_frame

    def websocket_interval(self) -> float:
        return 1.0 / max(self.scene_config.frame_rate, 0.1)

    def _frame_payload(
        self,
        heatmap: np.ndarray,
        detections: list[CfarDetection],
        tracks: list[TrackReport],
        simulated_fps: float,
        downsample: bool = False,
    ) -> dict:
        heatmap_for_payload = _downsample_heatmap(heatmap, 64) if downsample else heatmap
        detection_payload = [self._detection_payload(detection) for detection in detections[:48]]
        track_payload = [self._track_payload(track) for track in tracks]
        object_payload = [asdict(obj) for obj in self.objects]
        alerts = self._alerts(detection_payload, track_payload)
        return {
            "frame_id": self.frame_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "heatmap": np.round(heatmap_for_payload, 4).tolist(),
            "detections": detection_payload,
            "tracks": track_payload,
            "objects": object_payload,
            "alerts": alerts,
            "stats": self._stats(detection_payload, track_payload, simulated_fps),
        }

    def _detection_payload(self, detection: CfarDetection) -> dict:
        classification = classifier_service.predict(
            [
                detection.estimated_range_m,
                detection.estimated_velocity_mps,
                detection.power,
                detection.confidence,
            ]
        )
        return {
            "range_bin": detection.range_bin,
            "doppler_bin": detection.doppler_bin,
            "confidence": round(detection.confidence, 4),
            "estimated_range_m": round(detection.estimated_range_m, 2),
            "estimated_velocity_mps": round(detection.estimated_velocity_mps, 2),
            "power": round(detection.power, 4),
            "classification": classification,
        }

    def _track_payload(self, track: TrackReport) -> dict:
        return {
            "track_id": track.track_id,
            "range_m": round(track.range_m, 2),
            "velocity_mps": round(track.velocity_mps, 2),
            "confidence": round(track.confidence, 4),
            "age": track.age,
            "status": track.status,
        }

    def _alerts(self, detections: list[dict], tracks: list[dict]) -> list[str]:
        alerts: set[str] = set()
        if any(float(obj.range_m) <= RESTRICTED_ZONE_RANGE_M for obj in self.objects):
            alerts.add("restricted_zone_breach")
        if any(obj.label == "drone" for obj in self.objects) or any(d.get("classification") == "drone" for d in detections):
            alerts.add("drone_detected")
        if any(float(track.get("confidence", 0)) >= 0.85 for track in tracks):
            alerts.add("high_confidence_track")
        if any(obj.label == "unknown" for obj in self.objects) or any(d.get("classification") == "unknown" for d in detections):
            alerts.add("unknown_object")
        return sorted(alerts)

    def _stats(self, detections: list[dict], tracks: list[dict], simulated_fps: float | None = None) -> dict:
        confidences = [float(detection.get("confidence", 0)) for detection in detections]
        return {
            "active_tracks": len([track for track in tracks if track.get("status") != "lost"]),
            "detection_count": len(detections),
            "avg_confidence": round(sum(confidences) / max(len(confidences), 1), 4),
            "noise_level": self.scene_config.noise_level,
            "simulated_fps": round(simulated_fps if simulated_fps is not None else self.scene_config.frame_rate, 2),
        }

    def _advance_objects(self, objects: list[SceneObject], config: SceneConfig) -> list[SceneObject]:
        dt = 1.0 / max(config.frame_rate, 0.1)
        advanced: list[SceneObject] = []
        for obj in objects:
            next_range = obj.range_m + obj.velocity_mps * dt
            if next_range < 20 or next_range > config.radar_range_m:
                velocity = -obj.velocity_mps
                next_range = min(max(next_range, 20), config.radar_range_m)
            else:
                velocity = obj.velocity_mps
            advanced.append(
                SceneObject(
                    id=obj.id,
                    label=obj.label,
                    range_m=next_range,
                    velocity_mps=velocity,
                    angle_deg=obj.angle_deg,
                    rcs=obj.rcs,
                    altitude_m=obj.altitude_m,
                    heading_deg=obj.heading_deg,
                )
            )
        return advanced

    def _append_replay(self, frame: dict) -> None:
        if not self.replay_path:
            self.replay_path = self._new_replay_path()
        with self.replay_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(frame) + "\n")

    def _new_replay_path(self) -> Path:
        replay_dir = settings.data_dir / "replays"
        replay_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        return replay_dir / f"simulation-{timestamp}.jsonl"

    def _control_response(self, message: str) -> dict:
        return {
            "running": self.running,
            "frame_id": self.frame_id,
            "replay_path": str(self.replay_path) if self.replay_path else None,
            "message": message,
        }

    def _default_scene_config(self) -> SceneConfig:
        return SceneConfig(
            radar_range_m=3000,
            max_velocity_mps=120,
            noise_level=0.08,
            clutter_level=0.04,
            frame_rate=3.0,
            cfar_threshold_scale=4.2,
            guard_cells=2,
            training_cells=8,
            objects=[
                SceneObjectConfig(
                    id=1,
                    label="drone",
                    range_m=820,
                    velocity_mps=-18,
                    angle_deg=22,
                    rcs=12,
                    altitude_m=110,
                    heading_deg=214,
                ),
                SceneObjectConfig(
                    id=2,
                    label="bird",
                    range_m=1450,
                    velocity_mps=9,
                    angle_deg=-34,
                    rcs=4,
                    altitude_m=70,
                    heading_deg=78,
                ),
                SceneObjectConfig(
                    id=3,
                    label="vehicle",
                    range_m=1880,
                    velocity_mps=-24,
                    angle_deg=8,
                    rcs=36,
                    altitude_m=0,
                    heading_deg=270,
                ),
                SceneObjectConfig(
                    id=4,
                    label="human",
                    range_m=420,
                    velocity_mps=1.8,
                    angle_deg=-12,
                    rcs=7,
                    altitude_m=0,
                    heading_deg=18,
                ),
                SceneObjectConfig(
                    id=5,
                    label="unknown",
                    range_m=270,
                    velocity_mps=3.5,
                    angle_deg=42,
                    rcs=9,
                    altitude_m=12,
                    heading_deg=165,
                )
            ]
        )

    def _objects_from_config(self, config: SceneConfig) -> list[SceneObject]:
        if not config.objects:
            return generate_scene(count=5, seed=21)
        return [
            SceneObject(
                id=obj.id,
                label=obj.label,
                range_m=obj.range_m,
                velocity_mps=max(min(obj.velocity_mps, config.max_velocity_mps), -config.max_velocity_mps),
                angle_deg=obj.angle_deg,
                rcs=obj.rcs,
                altitude_m=obj.altitude_m,
                heading_deg=obj.heading_deg,
            )
            for obj in config.objects
        ]


def _downsample_heatmap(heatmap: np.ndarray, target_size: int) -> np.ndarray:
    rows, cols = heatmap.shape
    row_factor = max(rows // target_size, 1)
    col_factor = max(cols // target_size, 1)
    trimmed = heatmap[: target_size * row_factor, : target_size * col_factor]
    return trimmed.reshape(target_size, row_factor, target_size, col_factor).mean(axis=(1, 3))


simulation_manager = SimulationManager()
