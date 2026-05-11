from app.database import initialize_database
from app.config import settings
import uvicorn


if __name__ == "__main__":
    initialize_database()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
    )
