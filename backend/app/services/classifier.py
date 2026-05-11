from __future__ import annotations

import json
import math
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.config import settings
from app.models import OBJECT_CLASSES
from app.schemas import (
    ModelMetadata,
    ModelPredictionResponse,
    ModelPredictionScore,
    ModelPredictRequest,
    ModelServiceStatus,
    ModelStatus,
    ModelTrainRequest,
)
from app.services.dataset_generator import get_synthetic_dataset, list_synthetic_datasets


try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset

    TORCH_AVAILABLE = True
except ImportError:
    torch = None  # type: ignore[assignment]
    nn = None  # type: ignore[assignment]
    DataLoader = None  # type: ignore[assignment]
    TensorDataset = None  # type: ignore[assignment]
    TORCH_AVAILABLE = False


HEATMAP_CLASSES = ("drone", "bird", "vehicle", "human", "clutter", "unknown")


class ClassifierService:
    def __init__(self) -> None:
        self.model: RandomForestClassifier | None = None
        self.accuracy: float | None = None
        self.model_name = "aeris-random-forest-local"
        self.active_model: Any | None = None
        self.active_metadata: dict[str, Any] | None = None
        self.active_kind: str | None = None
        self.unknown_threshold = 0.42

    def _synthetic_training_data(self) -> tuple[np.ndarray, np.ndarray]:
        rng = np.random.default_rng(42)
        rows: list[list[float]] = []
        labels: list[str] = []
        profiles = {
            "drone": (850, 18, 0.74, 0.82),
            "bird": (620, 9, 0.45, 0.52),
            "vehicle": (1250, 34, 0.82, 0.84),
            "human": (420, 3, 0.38, 0.5),
            "clutter": (250, 1, 0.22, 0.32),
            "unknown": (1500, 15, 0.35, 0.42),
        }
        for label, center in profiles.items():
            for _ in range(120):
                rows.append(
                    [
                        max(20, rng.normal(center[0], 240)),
                        rng.normal(center[1], 16),
                        min(1, max(0, rng.normal(center[2], 0.12))),
                        min(1, max(0, rng.normal(center[3], 0.14))),
                    ]
                )
                labels.append(label)
        return np.array(rows), np.array(labels)

    def train_default_model(self) -> ModelStatus:
        features, labels = self._synthetic_training_data()
        x_train, x_test, y_train, y_test = train_test_split(features, labels, test_size=0.25, random_state=7)
        self.model = RandomForestClassifier(n_estimators=80, max_depth=8, random_state=7)
        self.model.fit(x_train, y_train)
        predictions = self.model.predict(x_test)
        self.accuracy = float(accuracy_score(y_test, predictions))
        model_marker = settings.data_dir / "models" / "aeris-random-forest-local.txt"
        model_marker.parent.mkdir(parents=True, exist_ok=True)
        model_marker.write_text(f"{self.model_name}\naccuracy={self.accuracy:.4f}\n", encoding="utf-8")
        return self.status()

    def predict(self, features: list[float]) -> str:
        if self.model is None:
            self.train_default_model()
        if self.model is None:
            return self._heuristic_predict(features)
        return str(self.model.predict(np.array([features]))[0])

    def _heuristic_predict(self, features: list[float]) -> str:
        range_m, velocity_mps, power, _confidence = features
        if abs(velocity_mps) < 3 and power < 0.35:
            return "clutter"
        if abs(velocity_mps) < 6 and range_m < 700:
            return "human"
        if abs(velocity_mps) > 25 and power > 0.55:
            return "vehicle"
        if power < 0.45:
            return "bird"
        return "drone"

    def status(self) -> ModelStatus:
        marker: Path = settings.data_dir / "models" / "aeris-random-forest-local.txt"
        return ModelStatus(
            trained=self.model is not None or marker.exists(),
            model_name=self.model_name,
            accuracy=self.accuracy,
            classes=list(OBJECT_CLASSES),
        )

    def train_heatmap_model(self, payload: ModelTrainRequest) -> ModelMetadata:
        dataset = self._resolve_dataset(payload.dataset_id)
        heatmaps, labels = self._load_dataset_arrays(dataset, payload.max_samples)
        if len(set(labels)) < 2:
            raise ValueError("Training requires at least two object classes in the selected dataset.")

        requested_type = payload.model_type
        if requested_type in {"auto", "torch_cnn"} and TORCH_AVAILABLE:
            try:
                return self._train_torch_cnn(dataset["dataset_id"], heatmaps, labels, payload)
            except Exception as exc:
                if requested_type == "torch_cnn":
                    raise RuntimeError(f"PyTorch CNN training failed: {exc}") from exc

        model_type = "logistic_regression" if requested_type == "logistic_regression" else "sklearn_rf"
        return self._train_sklearn(dataset["dataset_id"], heatmaps, labels, payload, model_type)

    def predict_heatmap(self, payload: ModelPredictRequest) -> ModelPredictionResponse:
        if self.active_model is None or self.active_metadata is None or self.active_kind is None:
            self._load_latest_model_if_available()
        if self.active_model is None or self.active_metadata is None or self.active_kind is None:
            raise LookupError("No trained classifier is loaded. Train a model with POST /api/model/train first.")

        heatmap = self._heatmap_from_prediction_payload(payload)
        start = time.perf_counter()
        if self.active_kind == "torch_cnn":
            class_scores = self._predict_torch(heatmap)
        else:
            class_scores = self._predict_sklearn(heatmap)
        inference_ms = (time.perf_counter() - start) * 1000

        threshold = payload.unknown_threshold or self.unknown_threshold
        top = sorted(class_scores.items(), key=lambda item: item[1], reverse=True)
        predicted_class, confidence = top[0]
        if confidence < threshold:
            predicted_class = "unknown"
            confidence = max(confidence, float(class_scores.get("unknown", 0.0)))

        top_predictions = [ModelPredictionScore(class_label=label, confidence=round(score, 4)) for label, score in top[:3]]
        if predicted_class == "unknown" and all(score.class_label != "unknown" for score in top_predictions):
            top_predictions.append(ModelPredictionScore(class_label="unknown", confidence=round(confidence, 4)))

        return ModelPredictionResponse(
            predicted_class=predicted_class,
            confidence=round(float(confidence), 4),
            top_predictions=top_predictions[:3],
            model_id=str(self.active_metadata["model_id"]),
            inference_ms=round(inference_ms, 3),
        )

    def service_status(self) -> ModelServiceStatus:
        if self.active_model is None:
            try:
                self._load_latest_model_if_available()
            except (FileNotFoundError, RuntimeError, OSError):
                pass
        metadata = self.active_metadata or {}
        return ModelServiceStatus(
            trained=self.active_model is not None,
            active_model_id=metadata.get("model_id"),
            active_model_type=metadata.get("type"),
            classes=list(metadata.get("classes", HEATMAP_CLASSES)),
            accuracy_estimate=metadata.get("accuracy_estimate"),
            torch_available=TORCH_AVAILABLE,
            available_models=len(self.list_models()),
        )

    def list_models(self) -> list[ModelMetadata]:
        model_root = settings.data_dir / "models"
        model_root.mkdir(parents=True, exist_ok=True)
        models: list[ModelMetadata] = []
        for metadata_path in sorted(model_root.glob("*/metadata.json"), reverse=True):
            try:
                metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
                models.append(self._metadata_response(metadata))
            except (OSError, json.JSONDecodeError, KeyError):
                continue
        return sorted(models, key=lambda model: model.created_at, reverse=True)

    def load_custom_model(self, model_id: str | None, model_path: str | None) -> ModelMetadata:
        if model_id:
            target = settings.data_dir / "models" / model_id
        elif model_path:
            target = Path(model_path)
            if target.is_file():
                target = target.parent
        else:
            raise ValueError("Provide either model_id or model_path.")

        target = target.resolve()
        models_root = (settings.data_dir / "models").resolve()
        if models_root not in target.parents and target != models_root:
            raise ValueError("Custom model path must be inside backend/app/data/models.")

        metadata = self._load_model_from_dir(target)
        return self._metadata_response(metadata)

    def _resolve_dataset(self, dataset_id: str | None) -> dict[str, Any]:
        if dataset_id:
            return get_synthetic_dataset(dataset_id)
        datasets = list_synthetic_datasets()
        if not datasets:
            raise FileNotFoundError("No generated datasets found. Create one with POST /api/dataset/generate first.")
        return get_synthetic_dataset(datasets[0].dataset_id)

    def _load_dataset_arrays(self, dataset: dict[str, Any], max_samples: int | None) -> tuple[np.ndarray, np.ndarray]:
        samples = list(dataset.get("samples", []))
        if max_samples:
            samples = samples[:max_samples]
        heatmaps: list[np.ndarray] = []
        labels: list[str] = []
        for sample in samples:
            npy_path = Path(str(sample["npy_path"]))
            if not npy_path.exists():
                continue
            label = str(sample["class_label"])
            if label not in HEATMAP_CLASSES:
                continue
            heatmaps.append(np.load(npy_path).astype(np.float32))
            labels.append(label)
        if len(heatmaps) < 10:
            raise ValueError("Dataset does not contain enough readable samples to train a classifier.")
        return np.stack(heatmaps), np.array(labels)

    def _train_sklearn(
        self,
        dataset_id: str,
        heatmaps: np.ndarray,
        labels: np.ndarray,
        payload: ModelTrainRequest,
        model_type: str,
    ) -> ModelMetadata:
        features = np.stack([self._extract_heatmap_features(heatmap) for heatmap in heatmaps])
        stratify = labels if min(np.unique(labels, return_counts=True)[1]) > 1 else None
        x_train, x_test, y_train, y_test = train_test_split(
            features,
            labels,
            test_size=payload.test_size,
            random_state=7,
            stratify=stratify,
        )
        if model_type == "logistic_regression":
            model: Any = Pipeline(
                [
                    ("scaler", StandardScaler()),
                    ("classifier", LogisticRegression(max_iter=500, random_state=7)),
                ]
            )
        else:
            model = RandomForestClassifier(n_estimators=120, max_depth=12, class_weight="balanced", random_state=7)
        model.fit(x_train, y_train)
        accuracy = float(accuracy_score(y_test, model.predict(x_test))) if len(y_test) else None

        model_id = self._new_model_id(model_type)
        model_dir = settings.data_dir / "models" / model_id
        model_dir.mkdir(parents=True, exist_ok=True)
        model_path = model_dir / "model.joblib"
        joblib.dump(model, model_path)
        metadata = self._write_metadata(model_dir, model_id, model_type, sorted(set(labels) | {"unknown"}), accuracy, dataset_id)

        self.active_model = model
        self.active_metadata = metadata
        self.active_kind = model_type
        self.unknown_threshold = payload.unknown_threshold
        return self._metadata_response(metadata)

    def _train_torch_cnn(
        self,
        dataset_id: str,
        heatmaps: np.ndarray,
        labels: np.ndarray,
        payload: ModelTrainRequest,
    ) -> ModelMetadata:
        if not TORCH_AVAILABLE or torch is None or nn is None or DataLoader is None or TensorDataset is None:
            return self._train_sklearn(dataset_id, heatmaps, labels, payload, "sklearn_rf")

        classes = sorted(set(labels))
        label_to_index = {label: index for index, label in enumerate(classes)}
        resized = np.stack([self._resize_heatmap(heatmap, 32) for heatmap in heatmaps]).astype(np.float32)
        y = np.array([label_to_index[str(label)] for label in labels], dtype=np.int64)
        stratify = y if min(np.unique(y, return_counts=True)[1]) > 1 else None
        x_train, x_test, y_train, y_test = train_test_split(
            resized,
            y,
            test_size=payload.test_size,
            random_state=7,
            stratify=stratify,
        )

        model = _TinyCnn(len(classes))
        optimizer = torch.optim.Adam(model.parameters(), lr=0.002)
        criterion = nn.CrossEntropyLoss()
        train_ds = TensorDataset(torch.tensor(x_train[:, None, :, :]), torch.tensor(y_train))
        loader = DataLoader(train_ds, batch_size=32, shuffle=True)
        model.train()
        for _epoch in range(4):
            for batch_x, batch_y in loader:
                optimizer.zero_grad()
                loss = criterion(model(batch_x), batch_y)
                loss.backward()
                optimizer.step()

        model.eval()
        with torch.no_grad():
            logits = model(torch.tensor(x_test[:, None, :, :]))
            predicted = logits.argmax(dim=1).numpy()
        accuracy = float(accuracy_score(y_test, predicted)) if len(y_test) else None

        model_id = self._new_model_id("torch_cnn")
        model_dir = settings.data_dir / "models" / model_id
        model_dir.mkdir(parents=True, exist_ok=True)
        torch.save({"state_dict": model.state_dict(), "classes": classes}, model_dir / "model.pt")
        metadata = self._write_metadata(model_dir, model_id, "torch_cnn", sorted(set(classes) | {"unknown"}), accuracy, dataset_id)

        self.active_model = model
        self.active_metadata = metadata
        self.active_kind = "torch_cnn"
        self.unknown_threshold = payload.unknown_threshold
        return self._metadata_response(metadata)

    def _predict_sklearn(self, heatmap: np.ndarray) -> dict[str, float]:
        features = self._extract_heatmap_features(heatmap).reshape(1, -1)
        if not hasattr(self.active_model, "predict_proba"):
            label = str(self.active_model.predict(features)[0])
            return {class_label: (1.0 if class_label == label else 0.0) for class_label in HEATMAP_CLASSES}
        probabilities = self.active_model.predict_proba(features)[0]
        labels = list(self.active_model.classes_)
        scores = {label: float(score) for label, score in zip(labels, probabilities, strict=False)}
        scores.setdefault("unknown", max(0.0, self.unknown_threshold - max(scores.values(), default=0.0)))
        return scores

    def _predict_torch(self, heatmap: np.ndarray) -> dict[str, float]:
        if not TORCH_AVAILABLE or torch is None:
            raise RuntimeError("PyTorch is not available for this loaded model.")
        resized = self._resize_heatmap(heatmap, 32).astype(np.float32)
        self.active_model.eval()
        with torch.no_grad():
            logits = self.active_model(torch.tensor(resized[None, None, :, :]))
            probabilities = torch.softmax(logits, dim=1).numpy()[0]
        classes = [label for label in self.active_metadata.get("classes", []) if label != "unknown"]
        scores = {label: float(score) for label, score in zip(classes, probabilities, strict=False)}
        scores.setdefault("unknown", max(0.0, self.unknown_threshold - max(scores.values(), default=0.0)))
        return scores

    def _heatmap_from_prediction_payload(self, payload: ModelPredictRequest) -> np.ndarray:
        if payload.heatmap is not None:
            heatmap = np.asarray(payload.heatmap, dtype=np.float32)
            if heatmap.ndim != 2 or heatmap.size == 0:
                raise ValueError("heatmap must be a non-empty 2D array.")
            return heatmap
        if payload.sample_id:
            dataset = self._resolve_dataset(payload.dataset_id)
            for sample in dataset.get("samples", []):
                if int(sample["sample_id"]) == payload.sample_id:
                    return np.load(Path(str(sample["npy_path"]))).astype(np.float32)
            raise FileNotFoundError(
                f"Sample {payload.sample_id} was not found in dataset {dataset.get('dataset_id', 'unknown')}."
            )
        raise ValueError("Provide either a heatmap array or dataset_id with sample_id.")

    def _extract_heatmap_features(self, heatmap: np.ndarray) -> np.ndarray:
        arr = np.asarray(heatmap, dtype=np.float32)
        if arr.ndim != 2:
            raise ValueError("Heatmap must be a 2D array.")
        arr = np.nan_to_num(arr, nan=0.0, posinf=1.0, neginf=0.0)
        if arr.max(initial=0.0) > 1.0:
            arr = arr / max(float(arr.max()), 1e-6)
        arr = np.clip(arr, 0.0, 1.0)
        rows, cols = arr.shape
        y_idx, x_idx = np.indices(arr.shape)
        total = float(arr.sum()) + 1e-8
        max_pos = np.unravel_index(int(np.argmax(arr)), arr.shape)
        centroid_y = float((y_idx * arr).sum() / total)
        centroid_x = float((x_idx * arr).sum() / total)
        spread_y = math.sqrt(float((((y_idx - centroid_y) ** 2) * arr).sum() / total))
        spread_x = math.sqrt(float((((x_idx - centroid_x) ** 2) * arr).sum() / total))
        row_profile = arr.mean(axis=1)
        col_profile = arr.mean(axis=0)
        threshold = max(float(arr.mean() + arr.std()), 0.15)
        hot_fraction = float((arr > threshold).mean())
        p95 = float(np.percentile(arr, 95))
        p99 = float(np.percentile(arr, 99))
        entropy = self._entropy(arr)
        return np.array(
            [
                float(arr.max()),
                float(arr.mean()),
                float(arr.std()),
                p95,
                p99,
                float(np.mean(arr**2)),
                max_pos[0] / max(rows - 1, 1),
                max_pos[1] / max(cols - 1, 1),
                centroid_y / max(rows - 1, 1),
                centroid_x / max(cols - 1, 1),
                spread_y / max(rows, 1),
                spread_x / max(cols, 1),
                float(row_profile.std()),
                float(col_profile.std()),
                hot_fraction,
                entropy,
            ],
            dtype=np.float32,
        )

    def _entropy(self, heatmap: np.ndarray) -> float:
        flat = heatmap.reshape(-1)
        total = float(flat.sum())
        if total <= 0:
            return 0.0
        probs = flat / total
        probs = probs[probs > 0]
        return float(-(probs * np.log2(probs)).sum() / math.log2(max(len(flat), 2)))

    def _resize_heatmap(self, heatmap: np.ndarray, size: int) -> np.ndarray:
        arr = np.asarray(heatmap, dtype=np.float32)
        row_edges = np.linspace(0, arr.shape[0], size + 1, dtype=int)
        col_edges = np.linspace(0, arr.shape[1], size + 1, dtype=int)
        resized = np.zeros((size, size), dtype=np.float32)
        for row in range(size):
            for col in range(size):
                patch = arr[row_edges[row] : max(row_edges[row + 1], row_edges[row] + 1), col_edges[col] : max(col_edges[col + 1], col_edges[col] + 1)]
                resized[row, col] = float(patch.mean()) if patch.size else 0.0
        max_value = float(resized.max(initial=0.0))
        return resized / max(max_value, 1e-6)

    def _write_metadata(
        self,
        model_dir: Path,
        model_id: str,
        model_type: str,
        classes: list[str],
        accuracy: float | None,
        dataset_id: str,
    ) -> dict[str, Any]:
        metadata = {
            "model_id": model_id,
            "type": model_type,
            "classes": classes,
            "accuracy_estimate": round(accuracy, 4) if accuracy is not None else None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "dataset_id": dataset_id,
            "path": str(model_dir),
        }
        (model_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
        return metadata

    def _load_latest_model_if_available(self) -> None:
        models = self.list_models()
        if models:
            self._load_model_from_dir(Path(models[0].path))

    def _load_model_from_dir(self, model_dir: Path) -> dict[str, Any]:
        metadata_path = model_dir / "metadata.json"
        if not metadata_path.exists():
            raise FileNotFoundError(f"No model metadata found at {metadata_path}.")
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        model_type = str(metadata["type"])
        if model_type == "torch_cnn":
            if not TORCH_AVAILABLE or torch is None:
                raise RuntimeError("This model requires PyTorch, but torch is not installed.")
            payload = torch.load(model_dir / "model.pt", map_location="cpu")
            classes = list(payload["classes"])
            model = _TinyCnn(len(classes))
            model.load_state_dict(payload["state_dict"])
            self.active_model = model
        else:
            self.active_model = joblib.load(model_dir / "model.joblib")
        self.active_metadata = metadata
        self.active_kind = model_type
        return metadata

    def _metadata_response(self, metadata: dict[str, Any]) -> ModelMetadata:
        return ModelMetadata(
            model_id=str(metadata["model_id"]),
            type=str(metadata["type"]),
            classes=list(metadata["classes"]),
            accuracy_estimate=metadata.get("accuracy_estimate"),
            created_at=str(metadata["created_at"]),
            dataset_id=str(metadata["dataset_id"]),
            path=str(metadata["path"]),
        )

    def _new_model_id(self, model_type: str) -> str:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        return f"model_{model_type}_{stamp}_{uuid4().hex[:8]}"


if TORCH_AVAILABLE:

    class _TinyCnn(nn.Module):  # type: ignore[misc]
        def __init__(self, class_count: int) -> None:
            super().__init__()
            self.net = nn.Sequential(
                nn.Conv2d(1, 8, kernel_size=3, padding=1),
                nn.ReLU(),
                nn.MaxPool2d(2),
                nn.Conv2d(8, 16, kernel_size=3, padding=1),
                nn.ReLU(),
                nn.MaxPool2d(2),
                nn.Flatten(),
                nn.Linear(16 * 8 * 8, 48),
                nn.ReLU(),
                nn.Linear(48, class_count),
            )

        def forward(self, x: Any) -> Any:
            return self.net(x)

else:

    class _TinyCnn:  # type: ignore[no-redef]
        pass


classifier_service = ClassifierService()
