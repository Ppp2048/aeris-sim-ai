# aeris-sim-ai

Local-only radar digital twin for synthetic target simulation, range-Doppler visualization, CFAR detection, Kalman tracking, and software object classification.

This project is inspired by radar signal-processing concepts, but it does not perform hardware control, RF transmission, PCB work, STM32 work, FPGA work, or any real-world radar operation. Everything here is synthetic simulation and visualization.

## Monorepo Layout

```text
aeris-sim-ai/
  backend/    FastAPI, SQLite, NumPy/SciPy/scikit-learn services
  frontend/   Next.js App Router, TypeScript, Tailwind dashboard
```

## Backend Setup

Windows PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload
```

macOS/Linux shell:

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend runs at [http://localhost:8000](http://localhost:8000). Health check: [http://localhost:8000/health](http://localhost:8000/health).

You can also run `python run_backend.py`, but the primary local development command is `uvicorn app.main:app --reload`.

If you use Windows Command Prompt instead of PowerShell, activate the backend environment with `.\.venv\Scripts\activate.bat`.

## Frontend Setup

Windows PowerShell:

```powershell
cd frontend
npm install
npm run dev
```

macOS/Linux shell:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at [http://localhost:3000](http://localhost:3000).

## Default Local Credentials

This project includes local development auth only. It is not production auth, and the default JWT secret and default admin password must not be used for any deployed system.

Default admin user, created automatically when the users table is empty:

- Email: `admin@aeris.local`
- Password: `admin123`
- Role: `admin`

Register a new user from the UI, or call `POST /api/auth/register`. User records are stored in `backend/app/data/aeris.db`.

## Core Capabilities

- Synthetic radar scene generation with configurable targets, noise, and sweep count
- Range-Doppler heatmap generation from simulated target returns
- Cell-averaging CFAR detection over synthetic heatmaps
- Constant-velocity Kalman tracking for detected objects
- Local ML classifier using scikit-learn with deterministic fallback heuristics
- Dataset generation and replay capture for repeatable experiments
- Custom parser and model registries for local-only integrations
- WebSocket stream endpoint for live dashboard updates

## Useful Endpoints

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/simulation/run`
- `POST /api/simulation/start`
- `POST /api/simulation/stop`
- `POST /api/simulation/step`
- `GET /api/simulation/status`
- `POST /api/simulation/scene`
- `GET /api/simulation/current-frame`
- `WebSocket /ws/simulation`
- `POST /api/dataset/generate`
- `GET /api/dataset/list`
- `GET /api/dataset/{dataset_id}`
- `GET /api/dataset/{dataset_id}/sample/{sample_id}`
- `POST /api/model/train`
- `POST /api/model/predict`
- `GET /api/model/status`
- `GET /api/model/list`
- `POST /api/model/load-custom`
- `POST /api/integrations/upload-data`
- `POST /api/integrations/parse`
- `GET /api/integrations/parsers`
- `POST /api/integrations/upload-model-metadata`
- `GET /api/integrations/model-adapters`

## Notes

- No Docker is required for the initial local workflow.
- The backend creates SQLite tables on startup.
- All data is stored locally under `backend/app/data/`.
- Synthetic datasets are stored under `backend/app/data/datasets/{dataset_id}/` with `metadata.json`, `.npy` heatmaps, per-sample JSON metadata, and PNG previews.
- Classifier models are small local artifacts stored under `backend/app/data/models/{model_id}/` with `metadata.json` and a local model file. PyTorch CNN mode is optional and falls back to scikit-learn when torch is not installed.
