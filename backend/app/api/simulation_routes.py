import asyncio

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from app.schemas import (
    SceneConfig,
    SimulationControlResponse,
    SimulationFrameResponse,
    SimulationRequest,
    SimulationResponse,
    SimulationStatusResponse,
    ReplayDeleteResponse,
    ReplayDetail,
    ReplaySummary,
)
from app.services.radar_simulator import run_simulation_pipeline
from app.services.replay_service import delete_replay, get_replay, list_replays
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


@router.get("/replays", response_model=list[ReplaySummary])
def simulation_replays() -> list[ReplaySummary]:
    return list_replays()


@router.get("/replays/{replay_id}", response_model=ReplayDetail)
def simulation_replay(replay_id: str) -> ReplayDetail:
    try:
        return get_replay(replay_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"Replay not found: {replay_id}") from exc


@router.delete("/replays/{replay_id}", response_model=ReplayDeleteResponse)
def remove_simulation_replay(replay_id: str) -> ReplayDeleteResponse:
    try:
        return delete_replay(replay_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"Replay not found: {replay_id}") from exc


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
