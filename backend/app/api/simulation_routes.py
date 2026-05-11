import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.schemas import (
    SceneConfig,
    SimulationControlResponse,
    SimulationFrameResponse,
    SimulationRequest,
    SimulationResponse,
    SimulationStatusResponse,
)
from app.services.radar_simulator import run_simulation_pipeline
from app.services.simulation_manager import simulation_manager


router = APIRouter()


@router.post("/run", response_model=SimulationResponse)
def run_simulation(payload: SimulationRequest) -> SimulationResponse:
    return run_simulation_pipeline(payload)


@router.post("/start", response_model=SimulationControlResponse)
def start_simulation() -> dict:
    return simulation_manager.start()


@router.post("/stop", response_model=SimulationControlResponse)
def stop_simulation() -> dict:
    return simulation_manager.stop()


@router.post("/step", response_model=SimulationFrameResponse)
def step_simulation() -> dict:
    return simulation_manager.step()


@router.get("/status", response_model=SimulationStatusResponse)
def simulation_status() -> dict:
    return simulation_manager.status()


@router.post("/scene", response_model=SimulationControlResponse)
def configure_scene(payload: SceneConfig) -> dict:
    return simulation_manager.set_scene(payload)


@router.get("/current-frame", response_model=SimulationFrameResponse)
def current_frame() -> dict:
    return simulation_manager.get_current_frame()


@router.websocket("/stream")
async def stream(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            if simulation_manager.running:
                await websocket.send_json(simulation_manager.step(websocket=True))
            else:
                await websocket.send_json({"type": "status", **simulation_manager.status()})
            await asyncio.sleep(simulation_manager.websocket_interval())
    except WebSocketDisconnect:
        return


async def simulation_websocket(websocket: WebSocket) -> None:
    await stream(websocket)
