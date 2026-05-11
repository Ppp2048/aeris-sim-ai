from typing import Any, Literal

from pydantic import BaseModel, Field


UserRole = Literal["admin", "analyst", "researcher"]
ObjectLabel = Literal["drone", "bird", "vehicle", "human", "clutter", "unknown"]
DatasetClass = Literal["drone", "bird", "vehicle", "human", "clutter"]
LocalEmail = str


class UserRegister(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: LocalEmail = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = "analyst"


class UserLogin(BaseModel):
    email: LocalEmail = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: LocalEmail
    role: UserRole
    created_at: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TargetConfig(BaseModel):
    id: int | None = None
    label: ObjectLabel = "unknown"
    range_m: float = Field(gt=1, le=5000)
    velocity_mps: float = Field(ge=-150, le=150)
    angle_deg: float = Field(default=0, ge=-90, le=90)
    rcs: float = Field(gt=0, le=100)
    altitude_m: float = Field(default=0, ge=0, le=20000)
    heading_deg: float = Field(default=0, ge=0, lt=360)


class SceneObjectConfig(BaseModel):
    id: int
    label: ObjectLabel = "unknown"
    range_m: float = Field(gt=1, le=5000)
    velocity_mps: float = Field(ge=-1000, le=1000)
    angle_deg: float = Field(default=0, ge=-90, le=90)
    rcs: float = Field(gt=0, le=100)
    altitude_m: float = Field(default=0, ge=0, le=20000)
    heading_deg: float = Field(default=0, ge=0, lt=360)


class SceneConfig(BaseModel):
    radar_range_m: float = Field(default=3000, gt=100, le=20000)
    max_velocity_mps: float = Field(default=120, gt=10, le=1000)
    noise_level: float = Field(default=0.08, ge=0.0, le=2.0)
    clutter_level: float = Field(default=0.035, ge=0.0, le=0.5)
    frame_rate: float = Field(default=2.0, gt=0.1, le=30)
    cfar_threshold_scale: float = Field(default=4.0, ge=1.1, le=20)
    guard_cells: int = Field(default=2, ge=1, le=8)
    training_cells: int = Field(default=8, ge=2, le=32)
    objects: list[SceneObjectConfig] = Field(default_factory=list)


class SimulationRequest(BaseModel):
    scenario_name: str = "local synthetic sweep"
    range_bins: int = Field(default=128, ge=32, le=512)
    doppler_bins: int = Field(default=128, ge=32, le=512)
    max_range_m: float = Field(default=3000, gt=100, le=20000)
    max_abs_velocity_mps: float = Field(default=120, gt=10, le=1000)
    noise_floor: float = Field(default=0.08, ge=0.0, le=2.0)
    clutter_density: float = Field(default=0.035, ge=0.0, le=0.5)
    cfar_guard_cells: int = Field(default=2, ge=1, le=8)
    cfar_training_cells: int = Field(default=8, ge=2, le=32)
    cfar_threshold_scale: float = Field(default=4.0, ge=1.1, le=20)
    targets: list[TargetConfig] = Field(default_factory=list)


class DetectionResponse(BaseModel):
    range_bin: int
    doppler_bin: int
    range_m: float
    velocity_mps: float
    power: float
    confidence: float
    classification: str
    track_id: int
    age: int
    status: str


class SimulationResponse(BaseModel):
    scenario_name: str
    range_axis: list[float]
    velocity_axis: list[float]
    heatmap: list[list[float]]
    detections: list[DetectionResponse]
    summary: dict[str, float | int | str]


class SimulationControlResponse(BaseModel):
    running: bool
    frame_id: int
    replay_path: str | None = None
    message: str


class SimulationStatusResponse(BaseModel):
    running: bool
    frame_id: int
    frame_rate: float
    object_count: int
    replay_path: str | None = None
    stats: dict[str, float | int]


class SimulationFrameResponse(BaseModel):
    frame_id: int
    timestamp: str
    heatmap: list[list[float]]
    detections: list[dict[str, float | int | str]]
    tracks: list[dict[str, float | int | str]]
    objects: list[dict[str, float | int | str]]
    alerts: list[str]
    stats: dict[str, float | int]


class ReplayAnalytics(BaseModel):
    total_frames: int
    total_detections: int
    max_confidence: float
    number_of_alerts: int
    longest_track_duration: int
    predicted_class_distribution: dict[str, int]


class ReplaySummary(BaseModel):
    replay_id: str
    filename: str
    created_at: str
    size_bytes: int
    frame_count: int
    analytics: ReplayAnalytics


class ReplayDetail(ReplaySummary):
    frames: list[dict[str, Any]]


class ReplayDeleteResponse(BaseModel):
    replay_id: str
    deleted: bool
    message: str


class DatasetRequest(BaseModel):
    name: str = "synthetic-radar-dataset"
    samples: int = Field(default=250, ge=10, le=5000)


class DatasetResponse(BaseModel):
    id: int
    name: str
    sample_count: int
    path: str


class SyntheticDatasetGenerateRequest(BaseModel):
    name: str = "aeris-synthetic-radar"
    samples_per_class: int = Field(default=25, ge=1, le=1000)
    class_counts: dict[DatasetClass, int] | None = None
    classes: list[DatasetClass] = Field(default_factory=lambda: ["drone", "bird", "vehicle", "human", "clutter"])
    range_bins: int = Field(default=128, ge=32, le=256)
    doppler_bins: int = Field(default=128, ge=32, le=256)
    radar_range_m: float = Field(default=3000, gt=100, le=20000)
    max_velocity_mps: float = Field(default=120, gt=10, le=1000)
    noise_level: float = Field(default=0.08, ge=0.0, le=2.0)
    clutter_level: float = Field(default=0.035, ge=0.0, le=0.5)


class SyntheticDatasetSummary(BaseModel):
    dataset_id: str
    name: str
    created_at: str
    classes: list[str]
    total_samples: int
    samples_per_class: dict[str, int]
    path: str


class SyntheticSampleResponse(BaseModel):
    dataset_id: str
    sample_id: int
    metadata: dict[str, float | int | str]
    heatmap_shape: list[int]
    heatmap_preview: list[list[float]]
    npy_path: str
    preview_png_path: str | None = None


class ModelStatus(BaseModel):
    trained: bool
    model_name: str
    accuracy: float | None = None
    classes: list[str]


ModelType = Literal["auto", "sklearn_rf", "logistic_regression", "torch_cnn"]


class ModelTrainRequest(BaseModel):
    dataset_id: str | None = None
    model_type: ModelType = "sklearn_rf"
    test_size: float = Field(default=0.25, gt=0.05, lt=0.5)
    max_samples: int | None = Field(default=None, ge=10, le=10000)
    unknown_threshold: float = Field(default=0.42, ge=0.05, le=0.95)


class ModelMetadata(BaseModel):
    model_id: str
    type: str
    classes: list[str]
    accuracy_estimate: float | None = None
    created_at: str
    dataset_id: str
    path: str


class ModelServiceStatus(BaseModel):
    trained: bool
    active_model_id: str | None = None
    active_model_type: str | None = None
    classes: list[str]
    accuracy_estimate: float | None = None
    torch_available: bool
    available_models: int


class ModelPredictRequest(BaseModel):
    heatmap: list[list[float]] | None = None
    dataset_id: str | None = None
    sample_id: int | None = Field(default=None, ge=1)
    unknown_threshold: float | None = Field(default=None, ge=0.05, le=0.95)


class ModelPredictionScore(BaseModel):
    class_label: str
    confidence: float


class ModelPredictionResponse(BaseModel):
    predicted_class: str
    confidence: float
    top_predictions: list[ModelPredictionScore]
    model_id: str
    inference_ms: float


class LoadCustomModelRequest(BaseModel):
    model_id: str | None = None
    model_path: str | None = None


class ParserInfo(BaseModel):
    name: str
    description: str
    supported_extensions: list[str]


class IntegrationUploadResponse(BaseModel):
    file_id: str
    filename: str
    path: str
    columns: list[str]
    row_count: int
    preview_rows: list[dict[str, str]]
    accepted_formats: list[str]
    warnings: list[str]


class IntegrationColumnMapping(BaseModel):
    range_m: str | None = None
    velocity_mps: str | None = None
    angle_deg: str | None = None
    amplitude: str | None = None
    timestamp: str | None = None
    class_label: str | None = None


class IntegrationParseRequest(BaseModel):
    file_id: str
    parser_name: str = "sample_csv_parser"
    column_mapping: IntegrationColumnMapping


class IntegrationParseResponse(BaseModel):
    file_id: str
    parser_name: str
    mapped_rows: list[dict[str, float | str | None]]
    row_count: int
    heatmap_preview: list[list[float]] | None = None
    warnings: list[str]


class ModelAdapterRequest(BaseModel):
    model_name: str = Field(min_length=1, max_length=120)
    model_type: str = Field(min_length=1, max_length=80)
    expected_input_shape: str = Field(min_length=1, max_length=80)
    classes: list[str] = Field(default_factory=list)
    notes: str = Field(default="", max_length=2000)


class ModelAdapterResponse(BaseModel):
    adapter_id: str
    model_name: str
    model_type: str
    expected_input_shape: str
    classes: list[str]
    notes: str
    created_at: str
    path: str
