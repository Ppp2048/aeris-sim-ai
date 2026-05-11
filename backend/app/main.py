from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth_routes, dataset_routes, integration_routes, model_routes, simulation_routes
from app.config import settings
from app.database import initialize_database


app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    initialize_database()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


app.include_router(auth_routes.router, prefix="/api/auth", tags=["auth"])
app.include_router(simulation_routes.router, prefix="/api/simulation", tags=["simulation"])
app.include_router(dataset_routes.legacy_router, prefix="/api/datasets", tags=["datasets"])
app.include_router(dataset_routes.router, prefix="/api/dataset", tags=["dataset"])
app.include_router(model_routes.router, prefix="/api/models", tags=["models"])
app.include_router(integration_routes.router, prefix="/api/integrations", tags=["integrations"])
app.add_api_websocket_route("/ws/simulation", simulation_routes.simulation_websocket)
