from pathlib import Path
from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "Aeris Sim AI"
    host: str = "127.0.0.1"
    port: int = 8000
    frontend_origin: str = "http://localhost:3000"
    jwt_secret: str = "local-dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60 * 12
    data_dir: Path = Path(__file__).resolve().parent / "data"

    @property
    def database_path(self) -> Path:
        return self.data_dir / "aeris.db"


settings = Settings()
