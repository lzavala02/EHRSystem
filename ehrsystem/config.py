"""Runtime configuration helpers for API and worker processes."""

from __future__ import annotations

import os
from dataclasses import dataclass

import sentry_sdk
from dotenv import load_dotenv

# Ensure local .env values (for example SENTRY_DSN) are loaded for app and worker.
load_dotenv()
sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    send_default_pii=False,
    traces_sample_rate=0.0,
    enable_logs=False,
)


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
    log_level: str = "INFO"
    log_dir: str = "logs"
    log_file: str = "ehrsystem.log"
    log_max_bytes: int = 10 * 1024 * 1024  # 10 MB
    log_backup_count: int = 3


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
        log_level=os.getenv("LOG_LEVEL", "INFO"),
        log_dir=os.getenv("LOG_DIR", "logs"),
        log_file=os.getenv("LOG_FILE", "ehrsystem.log"),
        log_max_bytes=int(os.getenv("LOG_MAX_BYTES", str(10 * 1024 * 1024))),
        log_backup_count=int(os.getenv("LOG_BACKUP_COUNT", "3")),
    )
