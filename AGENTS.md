# AGENTS.md

## Project
AERIS-Sim AI is a software-only radar digital twin for synthetic radar simulation, drone detection, target tracking, and AI heatmap classification.

## Scope
Build simulation, visualization, ML classification, local auth, dashboard, dataset generation, replay, and custom data integration.

## Out of Scope
Do not build hardware control.
Do not include RF transmission.
Do not include PCB/KiCad files.
Do not include STM32 firmware.
Do not include FPGA implementation.
Do not build military targeting functionality.

## Reference
The project is inspired by PLFM radar concepts from:
https://github.com/NawfalMotii79/PLFM_RADAR

Use it only for conceptual inspiration.

## Local-first Rules
The app must run locally.
No deployment setup for now.
No cloud dependencies.
No paid APIs.
No external model downloads unless explicitly requested.

## Stack
Frontend: Next.js, TypeScript, Tailwind, shadcn/ui, Framer Motion.
Backend: FastAPI, Python, NumPy, SciPy, scikit-learn, SQLite.
Realtime: WebSockets.
ML: local sklearn model first, optional small PyTorch CNN later.

## UI Direction
Premium futuristic radar command-center SaaS.
Dark/light mode.
Animated but not laggy.
Professional dashboards.
