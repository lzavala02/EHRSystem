"""Runtime configuration helpers for API and worker processes."""

from __future__ import annotations

import os
from dataclasses import dataclass


def _read_secret(file_env_var: str, direct_env_var: str, default: str) -> str:
    """Resolve a secret from a file path first, then env var, then default."""

    secret_file = os.getenv(file_env_var)
    if secret_file:
        with open(secret_file, encoding="utf-8") as secret_handle:
            return secret_handle.read().strip()

    return os.getenv(direct_env_var, default)


@dataclass(slots=True)
class Settings:
    """Typed runtime settings used by the Day 1 platform services."""

    app_name: str = "EHRSystem API"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    database_url: str = "postgresql://ehr:ehr@db:5432/ehrsystem"
    redis_url: str = "redis://redis:6379/0"
    worker_queue_name: str = "ehr-default"
    secret_key: str = "dev-insecure-change-me"


def load_settings() -> Settings:
    """Load runtime settings from environment variables."""

    return Settings(
        app_name=os.getenv("APP_NAME", "EHRSystem API"),
        app_env=os.getenv("APP_ENV", "development"),
        app_host=os.getenv("APP_HOST", "0.0.0.0"),
        app_port=int(os.getenv("APP_PORT", "8000")),
        database_url=os.getenv(
            "DATABASE_URL", "postgresql://ehr:ehr@db:5432/ehrsystem"
        ),
        redis_url=os.getenv("REDIS_URL", "redis://redis:6379/0"),
        worker_queue_name=os.getenv("WORKER_QUEUE_NAME", "ehr-default"),
        secret_key=_read_secret(
            file_env_var="APP_SECRET_KEY_FILE",
            direct_env_var="APP_SECRET_KEY",
            default="dev-insecure-change-me",
        ),
    )
