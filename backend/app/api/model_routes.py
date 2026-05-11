from fastapi import APIRouter

from app.schemas import ModelStatus
from app.services.classifier import classifier_service


router = APIRouter()


@router.get("/status", response_model=ModelStatus)
def status() -> ModelStatus:
    return classifier_service.status()


@router.post("/train", response_model=ModelStatus)
def train() -> ModelStatus:
    return classifier_service.train_default_model()
