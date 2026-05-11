from __future__ import annotations

import itertools

import numpy as np

from app.models import CfarDetection, TrackReport, TrackStatus


class KalmanTrack:
    def __init__(self, track_id: int, detection: CfarDetection) -> None:
        self.track_id = track_id
        self.state = np.array(
            [
                [detection.estimated_range_m],
                [detection.estimated_velocity_mps],
                [0.0],
                [0.0],
            ],
            dtype=float,
        )
        self.covariance = np.eye(4) * 25.0
        self.confidence = detection.confidence
        self.age = 1
        self.hits = 1
        self.misses = 0
        self.status: TrackStatus = "new"

    def predict(self, dt: float = 1.0) -> None:
        transition = np.array(
            [
                [1.0, 0.0, dt, 0.0],
                [0.0, 1.0, 0.0, dt],
                [0.0, 0.0, 1.0, 0.0],
                [0.0, 0.0, 0.0, 1.0],
            ]
        )
        process_noise = np.diag([4.0, 1.2, 2.0, 0.8])
        self.state = transition @ self.state
        self.covariance = transition @ self.covariance @ transition.T + process_noise
        self.age += 1
        self.misses += 1
        self._refresh_status()

    def update(self, detection: CfarDetection) -> None:
        measurement = np.array([[detection.estimated_range_m], [detection.estimated_velocity_mps]], dtype=float)
        measurement_matrix = np.array(
            [
                [1.0, 0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0, 0.0],
            ]
        )
        measurement_noise = np.diag([45.0, 6.0])
        residual = measurement - measurement_matrix @ self.state
        residual_covariance = measurement_matrix @ self.covariance @ measurement_matrix.T + measurement_noise
        gain = self.covariance @ measurement_matrix.T @ np.linalg.inv(residual_covariance)

        self.state = self.state + gain @ residual
        self.covariance = (np.eye(4) - gain @ measurement_matrix) @ self.covariance
        self.confidence = max(self.confidence * 0.85, detection.confidence)
        self.hits += 1
        self.misses = 0
        self._refresh_status()

    def gate_distance(self, detection: CfarDetection) -> float:
        range_error = abs(float(self.state[0, 0]) - detection.estimated_range_m) / 120.0
        velocity_error = abs(float(self.state[1, 0]) - detection.estimated_velocity_mps) / 10.0
        return range_error + velocity_error

    def report(self) -> TrackReport:
        return TrackReport(
            track_id=self.track_id,
            range_m=float(self.state[0, 0]),
            velocity_mps=float(self.state[1, 0]),
            confidence=float(max(0.0, self.confidence - self.misses * 0.08)),
            age=self.age,
            status=self.status,
        )

    def _refresh_status(self) -> None:
        if self.misses >= 3:
            self.status = "lost"
        elif self.hits >= 5 and self.confidence >= 0.65:
            self.status = "locked"
        elif self.hits >= 2:
            self.status = "tracking"
        else:
            self.status = "new"


class TrackerBank:
    def __init__(self) -> None:
        self._ids = itertools.count(1)
        self.tracks: list[KalmanTrack] = []

    def step(self, detections: list[CfarDetection], dt: float = 1.0) -> list[TrackReport]:
        for track in self.tracks:
            track.predict(dt)

        unmatched = list(detections)
        for track in self.tracks:
            if not unmatched:
                break
            best = min(unmatched, key=track.gate_distance)
            if track.gate_distance(best) <= 2.0:
                track.update(best)
                unmatched.remove(best)

        for detection in unmatched:
            self.tracks.append(KalmanTrack(next(self._ids), detection))

        self.tracks = [track for track in self.tracks if track.misses <= 5]
        return [track.report() for track in self.tracks]

    def update(self, range_m: float, velocity_mps: float, confidence: float = 0.5) -> int:
        detection = CfarDetection(0, 0, confidence, range_m, velocity_mps, confidence)
        report = self.step([detection])[0]
        return report.track_id

    def reset(self) -> None:
        self._ids = itertools.count(1)
        self.tracks = []


tracker_bank = TrackerBank()


def smoke_tracker() -> None:
    tracker = TrackerBank()
    for frame in range(6):
        detections = [CfarDetection(20 + frame, 18, 0.8, 500 + frame * 22, 12, 0.8)]
        print([report.__dict__ for report in tracker.step(detections)])


if __name__ == "__main__":
    smoke_tracker()
