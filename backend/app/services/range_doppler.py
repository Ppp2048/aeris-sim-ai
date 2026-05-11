from __future__ import annotations

import math

import numpy as np

from app.models import SceneObject


def make_axes(
    range_bins: int = 128,
    doppler_bins: int = 128,
    max_range_m: float = 3000,
    max_abs_velocity_mps: float = 120,
) -> tuple[np.ndarray, np.ndarray]:
    range_axis = np.linspace(0, max_range_m, range_bins)
    velocity_axis = np.linspace(-max_abs_velocity_mps, max_abs_velocity_mps, doppler_bins)
    return range_axis, velocity_axis


def _signature_for(target: SceneObject) -> tuple[float, float, float, float]:
    if target.label == "drone":
        return 1.25, 1.7, 0.16, 0.11
    if target.label == "bird":
        return 1.7, 2.5, 0.09, 0.2
    if target.label == "vehicle":
        return 2.4, 1.2, 0.04, 0.03
    if target.label == "human":
        return 1.8, 1.8, 0.06, 0.05
    if target.label == "clutter":
        return 3.2, 3.2, 0.02, 0.0
    return 2.0, 2.0, 0.04, 0.04


def add_target_peak(
    heatmap: np.ndarray,
    target: SceneObject,
    range_axis: np.ndarray,
    velocity_axis: np.ndarray,
    rng: np.random.Generator,
) -> None:
    range_grid, velocity_grid = np.meshgrid(range_axis, velocity_axis)
    range_step = max(float(range_axis[1] - range_axis[0]), 1.0)
    velocity_step = max(float(velocity_axis[1] - velocity_axis[0]), 1.0)
    range_spread, doppler_spread, shimmer, sideband = _signature_for(target)

    range_sigma = range_step * range_spread
    doppler_sigma = velocity_step * doppler_spread
    angle_attenuation = max(0.25, math.cos(math.radians(abs(target.angle_deg))) ** 2)
    altitude_factor = 1.0 + min(target.altitude_m / 2000, 0.4)
    amplitude = max(target.rcs, 0.1) * angle_attenuation * altitude_factor

    main_lobe = np.exp(
        -(
            ((range_grid - target.range_m) ** 2) / (2 * range_sigma**2)
            + ((velocity_grid - target.velocity_mps) ** 2) / (2 * doppler_sigma**2)
        )
    )
    heatmap += main_lobe * amplitude

    if target.label in {"drone", "bird"}:
        wingbeat = np.sin((velocity_grid - target.velocity_mps) / max(velocity_step, 1.0) * math.pi)
        heatmap += main_lobe * amplitude * shimmer * (wingbeat + 1.0) / 2.0

    if sideband > 0:
        for offset in (-2.5, 2.5):
            side_lobe = np.exp(
                -(
                    ((range_grid - target.range_m) ** 2) / (2 * (range_sigma * 1.15) ** 2)
                    + ((velocity_grid - (target.velocity_mps + offset * velocity_step)) ** 2)
                    / (2 * (doppler_sigma * 0.85) ** 2)
                )
            )
            heatmap += side_lobe * amplitude * sideband

    target_texture = rng.normal(0, shimmer * 0.1, size=heatmap.shape)
    heatmap += np.clip(main_lobe * target_texture, 0, None)


def add_clutter(
    heatmap: np.ndarray,
    range_axis: np.ndarray,
    velocity_axis: np.ndarray,
    density: float,
    rng: np.random.Generator,
) -> None:
    if density <= 0:
        return

    range_grid, velocity_grid = np.meshgrid(range_axis, velocity_axis)
    ground_band = np.exp(-(velocity_grid**2) / (2 * 5.0**2))
    near_range_bias = np.exp(-range_grid / max(float(range_axis[-1]), 1.0))
    heatmap += ground_band * near_range_bias * density * 6.0

    clutter_count = int(density * heatmap.size * 0.018)
    rows, cols = heatmap.shape
    for _ in range(clutter_count):
        row = int(rng.integers(0, rows))
        col = int(rng.integers(0, cols))
        heatmap[row, col] += float(rng.uniform(0.04, 0.25))


def build_range_doppler(
    targets: list[SceneObject],
    range_bins: int = 128,
    doppler_bins: int = 128,
    noise_floor: float = 0.08,
    clutter_density: float = 0.035,
    max_range_m: float = 3000,
    max_abs_velocity_mps: float = 120,
    seed: int | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    range_axis, velocity_axis = make_axes(range_bins, doppler_bins, max_range_m, max_abs_velocity_mps)
    heatmap = rng.normal(loc=0.0, scale=noise_floor, size=(doppler_bins, range_bins))
    heatmap = np.abs(heatmap)

    add_clutter(heatmap, range_axis, velocity_axis, clutter_density, rng)
    for target in targets:
        add_target_peak(heatmap, target, range_axis, velocity_axis, rng)

    heatmap = np.clip(heatmap, 0, None)
    heatmap -= float(np.min(heatmap))
    peak = max(float(np.max(heatmap)), 1e-9)
    return heatmap / peak, range_axis, velocity_axis


def smoke_range_doppler() -> None:
    targets = [
        SceneObject(1, "drone", 850, 18, 12, 12, 120, 45),
        SceneObject(2, "vehicle", 1350, -24, -8, 30, 0, 270),
    ]
    heatmap, _, _ = build_range_doppler(targets, seed=7)
    print({"shape": heatmap.shape, "min": float(heatmap.min()), "max": float(heatmap.max())})


if __name__ == "__main__":
    smoke_range_doppler()
