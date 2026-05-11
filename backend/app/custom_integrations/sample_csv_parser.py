import csv
from pathlib import Path


def parse_sample_csv(path: str) -> list[dict[str, str]]:
    source = Path(path)
    with source.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))
