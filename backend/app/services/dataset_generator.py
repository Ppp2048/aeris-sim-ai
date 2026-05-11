import csv

import numpy as np

from app.config import settings
from app.database import get_connection
from app.schemas import DatasetRequest, DatasetResponse


def generate_dataset(payload: DatasetRequest) -> DatasetResponse:
    rng = np.random.default_rng()
    path = settings.data_dir / "datasets" / f"{payload.name.replace(' ', '-').lower()}.csv"
    classes = ["drone", "aircraft", "vehicle", "bird"]

    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["range_m", "velocity_mps", "power", "confidence", "label"])
        for index in range(payload.samples):
            label = classes[index % len(classes)]
            base_range = {"drone": 850, "aircraft": 1800, "vehicle": 420, "bird": 620}[label]
            base_velocity = {"drone": 18, "aircraft": 70, "vehicle": 12, "bird": 8}[label]
            writer.writerow(
                [
                    round(float(rng.normal(base_range, 260)), 3),
                    round(float(rng.normal(base_velocity, 18)), 3),
                    round(float(rng.uniform(0.25, 0.98)), 4),
                    round(float(rng.uniform(0.35, 0.99)), 4),
                    label,
                ]
            )

    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO datasets (name, sample_count, path) VALUES (?, ?, ?)",
            (payload.name, payload.samples, str(path)),
        )
        dataset_id = int(cursor.lastrowid)

    return DatasetResponse(id=dataset_id, name=payload.name, sample_count=payload.samples, path=str(path))
