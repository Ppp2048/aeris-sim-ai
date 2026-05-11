from fastapi import APIRouter, HTTPException, status

from app.schemas import (
    DatasetRequest,
    DatasetResponse,
    SyntheticDatasetGenerateRequest,
    SyntheticDatasetSummary,
    SyntheticSampleResponse,
)
from app.services.dataset_generator import (
    generate_dataset,
    generate_synthetic_dataset,
    get_synthetic_dataset,
    get_synthetic_sample,
    list_synthetic_datasets,
)


router = APIRouter()
legacy_router = APIRouter()


@legacy_router.post("/generate", response_model=DatasetResponse)
def create_dataset(payload: DatasetRequest) -> DatasetResponse:
    return generate_dataset(payload)


@router.post("/generate", response_model=SyntheticDatasetSummary)
def generate_synthetic(payload: SyntheticDatasetGenerateRequest) -> SyntheticDatasetSummary:
    return generate_synthetic_dataset(payload)


@router.get("/list", response_model=list[SyntheticDatasetSummary])
def list_datasets() -> list[SyntheticDatasetSummary]:
    return list_synthetic_datasets()


@router.get("/{dataset_id}/sample/{sample_id}", response_model=SyntheticSampleResponse)
def sample(dataset_id: str, sample_id: int) -> SyntheticSampleResponse:
    try:
        return get_synthetic_sample(dataset_id, sample_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset sample not found") from exc


@router.get("/{dataset_id}")
def dataset(dataset_id: str) -> dict:
    try:
        return get_synthetic_dataset(dataset_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found") from exc
