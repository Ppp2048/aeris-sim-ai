from fastapi import APIRouter

from app.custom_integrations.model_registry import model_registry
from app.custom_integrations.parser_registry import parser_registry
from app.schemas import ParserInfo


router = APIRouter()


@router.get("/parsers", response_model=list[ParserInfo])
def parsers() -> list[ParserInfo]:
    return parser_registry.list_parsers()


@router.get("/models")
def models() -> dict[str, list[str]]:
    return {"models": model_registry.list_models()}
