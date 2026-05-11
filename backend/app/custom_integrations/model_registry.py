class ModelRegistry:
    def __init__(self) -> None:
        self._models = ["aeris-random-forest-local", "heuristic-signal-profile"]

    def list_models(self) -> list[str]:
        return self._models


model_registry = ModelRegistry()
