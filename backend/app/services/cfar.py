from __future__ import annotations

import numpy as np

from app.models import CfarDetection


def detect_cfar(
    heatmap: np.ndarray,
    range_axis: np.ndarray,
    velocity_axis: np.ndarray,
    guard_cells: int = 2,
    training_cells: int = 8,
    threshold_scale: float = 4.0,
    min_power: float = 0.18,
    max_detections: int = 64,
) -> list[CfarDetection]:
    detections: list[CfarDetection] = []
    radius = guard_cells + training_cells
    doppler_bins, range_bins = heatmap.shape

    for doppler_bin in range(radius, doppler_bins - radius):
        for range_bin in range(radius, range_bins - radius):
            window = heatmap[
                doppler_bin - radius : doppler_bin + radius + 1,
                range_bin - radius : range_bin + radius + 1,
            ]
            guard = heatmap[
                doppler_bin - guard_cells : doppler_bin + guard_cells + 1,
                range_bin - guard_cells : range_bin + guard_cells + 1,
            ]
            training_sum = float(np.sum(window) - np.sum(guard))
            training_count = max(window.size - guard.size, 1)
            noise_level = training_sum / training_count
            threshold = noise_level * threshold_scale
            power = float(heatmap[doppler_bin, range_bin])

            if power <= threshold or power < min_power:
                continue

            confidence = min(1.0, (power - threshold) / max(1.0 - threshold, 1e-6))
            detections.append(
                CfarDetection(
                    range_bin=range_bin,
                    doppler_bin=doppler_bin,
                    confidence=confidence,
                    estimated_range_m=float(range_axis[range_bin]),
                    estimated_velocity_mps=float(velocity_axis[doppler_bin]),
                    power=power,
                )
            )

    detections.sort(key=lambda detection: (detection.confidence, detection.power), reverse=True)
    return _non_max_suppress(detections, max_detections=max_detections)


def _non_max_suppress(detections: list[CfarDetection], max_detections: int) -> list[CfarDetection]:
    kept: list[CfarDetection] = []
    for candidate in detections:
        overlaps = any(
            abs(candidate.range_bin - existing.range_bin) <= 3
            and abs(candidate.doppler_bin - existing.doppler_bin) <= 3
            for existing in kept
        )
        if not overlaps:
            kept.append(candidate)
        if len(kept) >= max_detections:
            break
    return kept


def smoke_cfar() -> None:
    heatmap = np.zeros((32, 32), dtype=float)
    heatmap += 0.03
    heatmap[16, 18] = 1.0
    range_axis = np.linspace(0, 3000, 32)
    velocity_axis = np.linspace(-120, 120, 32)
    detections = detect_cfar(heatmap, range_axis, velocity_axis, training_cells=3)
    print([detection.__dict__ for detection in detections])


if __name__ == "__main__":
    smoke_cfar()
