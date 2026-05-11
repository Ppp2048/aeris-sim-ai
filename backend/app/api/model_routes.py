from fastapi import APIRouter, HTTPException

from app.schemas import (
    LoadCustomModelRequest,
    ModelMetadata,
    ModelPredictionResponse,
    ModelPredictRequest,
    ModelServiceStatus,
    ModelStatus,
    ModelTrainRequest,
)
from app.services.classifier import classifier_service


router = APIRouter()
legacy_router = APIRouter()


@router.post("/train", response_model=ModelMetadata)
def train(payload: ModelTrainRequest | None = None) -> ModelMetadata:
    payload = payload or ModelTrainRequest()
    try:
        return classifier_service.train_heatmap_model(payload)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/predict", response_model=ModelPredictionResponse)
def predict(payload: ModelPredictRequest) -> ModelPredictionResponse:
    try:
        return classifier_service.predict_heatmap(payload)
    except LookupError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/status", response_model=ModelServiceStatus)
def status() -> ModelServiceStatus:
    return classifier_service.service_status()


@router.get("/list", response_model=list[ModelMetadata])
def list_models() -> list[ModelMetadata]:
    return classifier_service.list_models()


@router.post("/load-custom", response_model=ModelMetadata)
def load_custom(payload: LoadCustomModelRequest) -> ModelMetadata:
    try:
        return classifier_service.load_custom_model(payload.model_id, payload.model_path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@legacy_router.get("/status", response_model=ModelStatus)
def legacy_status() -> ModelStatus:
    return classifier_service.status()


@legacy_router.post("/train", response_model=ModelStatus)
def legacy_train() -> ModelStatus:
    return classifier_service.train_default_model()
