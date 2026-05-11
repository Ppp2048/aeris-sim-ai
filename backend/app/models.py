from dataclasses import dataclass
from typing import Literal


OBJECT_CLASSES = ("drone", "bird", "vehicle", "human", "clutter", "unknown")
ObjectLabel = Literal["drone", "bird", "vehicle", "human", "clutter", "unknown"]
TrackStatus = Literal["new", "tracking", "locked", "lost"]


@dataclass(frozen=True)
class SceneObject:
    id: int
    label: ObjectLabel
    range_m: float
    velocity_mps: float
    angle_deg: float
    rcs: float
    altitude_m: float
    heading_deg: float


@dataclass(frozen=True)
class CfarDetection:
    range_bin: int
    doppler_bin: int
    confidence: float
    estimated_range_m: float
    estimated_velocity_mps: float
    power: float


@dataclass(frozen=True)
class TrackReport:
    track_id: int
    range_m: float
    velocity_mps: float
    confidence: float
    age: int
    status: TrackStatus
    confidence: float
