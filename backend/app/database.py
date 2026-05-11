import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from passlib.context import CryptContext

from app.config import settings


password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def ensure_data_dirs() -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    for folder in ("datasets", "models", "replays"):
        (settings.data_dir / folder).mkdir(parents=True, exist_ok=True)


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    ensure_data_dirs()
    conn = sqlite3.connect(settings.database_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def initialize_database() -> Path:
    ensure_data_dirs()
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL DEFAULT 'Local Operator',
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'analyst' CHECK (role IN ('admin', 'analyst', 'researcher')),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS simulation_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scenario_name TEXT NOT NULL,
                target_count INTEGER NOT NULL,
                detections INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                payload TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS datasets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                sample_count INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                path TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS model_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                accuracy REAL NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                path TEXT NOT NULL
            );
            """
        )
        _migrate_users_table(conn)
        _create_default_admin(conn)
    return settings.database_path


def _table_columns(conn: sqlite3.Connection, table_name: str) -> set[str]:
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()}


def _migrate_users_table(conn: sqlite3.Connection) -> None:
    columns = _table_columns(conn, "users")
    if "name" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT 'Local Operator'")
    if "role" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'analyst'")


def _create_default_admin(conn: sqlite3.Connection) -> None:
    user_count = conn.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"]
    if user_count:
        return
    conn.execute(
        """
        INSERT INTO users (name, email, hashed_password, role)
        VALUES (?, ?, ?, ?)
        """,
        ("AERIS Admin", "admin@aeris.local", password_context.hash("admin123"), "admin"),
    )
