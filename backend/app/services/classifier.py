from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

from app.config import settings
from app.models import OBJECT_CLASSES
from app.schemas import ModelStatus


class ClassifierService:
    def __init__(self) -> None:
        self.model: RandomForestClassifier | None = None
        self.accuracy: float | None = None
        self.model_name = "aeris-random-forest-local"

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


classifier_service = ClassifierService()
