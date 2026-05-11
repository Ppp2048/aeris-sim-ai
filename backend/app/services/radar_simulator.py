from __future__ import annotations

import json
import random
from dataclasses import asdict

import numpy as np

from app.database import get_connection
from app.models import OBJECT_CLASSES, CfarDetection, SceneObject, TrackReport
from app.schemas import DetectionResponse, SimulationRequest, SimulationResponse
from app.services.cfar import detect_cfar
from app.services.classifier import classifier_service
from app.services.kalman_tracker import TrackerBank, tracker_bank
from app.services.range_doppler import build_range_doppler


def generate_scene(count: int = 5, seed: int | None = None) -> list[SceneObject]:
    rng = random.Random(seed)
    labels = ["drone", "bird", "vehicle", "human", "clutter"]
    scene: list[SceneObject] = []
    for index in range(count):
        label = labels[index % len(labels)]
        scene.append(
            SceneObject(
                id=index + 1,
                label=label,
                range_m=rng.uniform(180, 2600),
                velocity_mps=_velocity_for(label, rng),
                angle_deg=rng.uniform(-55, 55),
                rcs=_rcs_for(label, rng),
                altitude_m=_altitude_for(label, rng),
                heading_deg=rng.uniform(0, 359),
            )
        )
    return scene


def _velocity_for(label: str, rng: random.Random) -> float:
    if label == "drone":
        return rng.uniform(-28, 34)
    if label == "bird":
        return rng.uniform(-18, 22)
    if label == "vehicle":
        return rng.uniform(-45, 45)
    if label == "human":
        return rng.uniform(-4, 4)
    if label == "clutter":
        return rng.uniform(-2, 2)
    return rng.uniform(-30, 30)


def _rcs_for(label: str, rng: random.Random) -> float:
    if label == "drone":
        return rng.uniform(7, 18)
    if label == "bird":
        return rng.uniform(2, 8)
    if label == "vehicle":
        return rng.uniform(18, 45)
    if label == "human":
        return rng.uniform(3, 9)
    if label == "clutter":
        return rng.uniform(1, 5)
    return rng.uniform(2, 15)


def _altitude_for(label: str, rng: random.Random) -> float:
    if label == "drone":
        return rng.uniform(25, 180)
    if label == "bird":
        return rng.uniform(8, 90)
    if label == "vehicle":
        return rng.uniform(0, 3)
    if label == "human":
        return rng.uniform(0, 2)
    return 0


def _targets_from_request(payload: SimulationRequest) -> list[SceneObject]:
    if not payload.targets:
        return generate_scene()

    targets: list[SceneObject] = []
    for index, target in enumerate(payload.targets, start=1):
        label = target.label if target.label in OBJECT_CLASSES else "unknown"
        targets.append(
            SceneObject(
                id=target.id or index,
                label=label,
                range_m=target.range_m,
                velocity_mps=target.velocity_mps,
                angle_deg=target.angle_deg,
                rcs=target.rcs,
                altitude_m=target.altitude_m,
                heading_deg=target.heading_deg,
            )
        )
    return targets


def simulate_frame(
    scene: list[SceneObject],
    range_bins: int = 128,
    doppler_bins: int = 128,
    noise_floor: float = 0.08,
    clutter_density: float = 0.035,
    max_range_m: float = 3000,
    max_abs_velocity_mps: float = 120,
    guard_cells: int = 2,
    training_cells: int = 8,
    threshold_scale: float = 4.0,
    tracker: TrackerBank | None = None,
    seed: int | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, list[CfarDetection], list[TrackReport]]:
    heatmap, range_axis, velocity_axis = build_range_doppler(
        targets=scene,
        range_bins=range_bins,
        doppler_bins=doppler_bins,
        noise_floor=noise_floor,
        clutter_density=clutter_density,
        max_range_m=max_range_m,
        max_abs_velocity_mps=max_abs_velocity_mps,
        seed=seed,
    )
    detections = detect_cfar(
        heatmap=heatmap,
        range_axis=range_axis,
        velocity_axis=velocity_axis,
        guard_cells=guard_cells,
        training_cells=training_cells,
        threshold_scale=threshold_scale,
    )
    active_tracker = tracker or tracker_bank
    tracks = active_tracker.step(detections)
    return heatmap, range_axis, velocity_axis, detections, tracks


def _nearest_track(detection: CfarDetection, tracks: list[TrackReport]) -> TrackReport | None:
    if not tracks:
        return None
    return min(
        tracks,
        key=lambda track: abs(track.range_m - detection.estimated_range_m) / 120
        + abs(track.velocity_mps - detection.estimated_velocity_mps) / 10,
    )


def run_simulation_pipeline(payload: SimulationRequest) -> SimulationResponse:
    scene = _targets_from_request(payload)
    heatmap, range_axis, velocity_axis, detections, tracks = simulate_frame(
        scene=scene,
        range_bins=payload.range_bins,
        doppler_bins=payload.doppler_bins,
        noise_floor=payload.noise_floor,
        clutter_density=payload.clutter_density,
        max_range_m=payload.max_range_m,
        max_abs_velocity_mps=payload.max_abs_velocity_mps,
        guard_cells=payload.cfar_guard_cells,
        training_cells=payload.cfar_training_cells,
        threshold_scale=payload.cfar_threshold_scale,
    )

    responses: list[DetectionResponse] = []
    for detection in detections[:24]:
        track = _nearest_track(detection, tracks)
        classification = classifier_service.predict(
            [
                detection.estimated_range_m,
                detection.estimated_velocity_mps,
                detection.power,
                detection.confidence,
            ]
        )
        responses.append(
            DetectionResponse(
                range_bin=detection.range_bin,
                doppler_bin=detection.doppler_bin,
                range_m=round(detection.estimated_range_m, 2),
                velocity_mps=round(detection.estimated_velocity_mps, 2),
                power=round(detection.power, 4),
                confidence=round(detection.confidence, 4),
                classification=classification,
                track_id=track.track_id if track else 0,
                age=track.age if track else 0,
                status=track.status if track else "new",
            )
        )

    result = SimulationResponse(
        scenario_name=payload.scenario_name,
        range_axis=[round(float(value), 2) for value in range_axis.tolist()],
        velocity_axis=[round(float(value), 2) for value in velocity_axis.tolist()],
        heatmap=np.round(heatmap, 4).tolist(),
        detections=responses,
        summary={
            "targets": len(scene),
            "detections": len(responses),
            "tracks": len(tracks),
            "peak_power": round(float(np.max(heatmap)), 4),
            "mean_noise": round(float(np.mean(heatmap)), 4),
            "mode": "educational-simulation-only",
        },
    )

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO simulation_runs (scenario_name, target_count, detections, payload)
            VALUES (?, ?, ?, ?)
            """,
            (
                payload.scenario_name,
                len(scene),
                len(responses),
                json.dumps({"scene": [asdict(target) for target in scene], "result": result.model_dump()}),
            ),
        )
    return result


def smoke_radar_simulation() -> None:
    local_tracker = TrackerBank()
    scene = generate_scene(seed=11)
    for frame in range(3):
        moved_scene = [
            SceneObject(
                id=target.id,
                label=target.label,
                range_m=max(1, target.range_m + target.velocity_mps * frame),
                velocity_mps=target.velocity_mps,
                angle_deg=target.angle_deg,
                rcs=target.rcs,
                altitude_m=target.altitude_m,
                heading_deg=target.heading_deg,
            )
            for target in scene
        ]
        _, _, _, detections, tracks = simulate_frame(moved_scene, tracker=local_tracker, seed=100 + frame)
        print(
            {
                "frame": frame,
                "detections": [detection.__dict__ for detection in detections[:5]],
                "tracks": [track.__dict__ for track in tracks[:5]],
            }
        )


if __name__ == "__main__":
    smoke_radar_simulation()
