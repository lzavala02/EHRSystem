"""HTTP API process for Day 1 platform setup."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import FastAPI
from psycopg import connect
from redis import Redis

from .config import load_settings

settings = load_settings()
app = FastAPI(title=settings.app_name)


@app.get("/health/live")
def liveness() -> dict[str, str]:
    """Container/process level health check."""

    return {"status": "ok", "service": "api", "environment": settings.app_env}


@app.get("/health/ready")
def readiness() -> dict[str, str]:
    """Dependency-aware readiness probe for DB and queue broker."""

    checks: dict[str, str] = {"database": "down", "redis": "down"}

    with connect(settings.database_url) as db_conn:
        with db_conn.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
            checks["database"] = "up"

    redis_client = Redis.from_url(settings.redis_url)
    if redis_client.ping():
        checks["redis"] = "up"

    return {
        "status": "ok",
        "service": "api",
        "checked_at": datetime.now(UTC).isoformat(),
        "database": checks["database"],
        "redis": checks["redis"],
    }
