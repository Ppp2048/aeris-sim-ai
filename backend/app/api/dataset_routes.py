from fastapi import APIRouter

from app.schemas import DatasetRequest, DatasetResponse
from app.services.dataset_generator import generate_dataset


router = APIRouter()


@router.post("/generate", response_model=DatasetResponse)
def create_dataset(payload: DatasetRequest) -> DatasetResponse:
    return generate_dataset(payload)
