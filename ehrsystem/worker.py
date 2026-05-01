"""Background worker process bootstrap for Day 1 queue setup."""

from __future__ import annotations

import logging
import os

import sentry_sdk
from dotenv import load_dotenv
from redis import Redis
from rq import Queue, Worker

from .config import load_settings
from .logging_config import setup_logging


def run_worker() -> None:
    """Start the worker and listen to the configured queue."""

    # Entry-point bootstrap: load .env before reading runtime settings.
    load_dotenv()
    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN"),
        send_default_pii=False,
        traces_sample_rate=0.0,
        enable_logs=False,
    )
    settings = load_settings()

    # Initialize logging
    setup_logging(
        log_dir=settings.log_dir,
        log_file=settings.log_file,
        log_level=settings.log_level,
        max_bytes=settings.log_max_bytes,
        backup_count=settings.log_backup_count,
    )

    logger = logging.getLogger(__name__)
    logger.info(f"Starting worker for queue: {settings.worker_queue_name}")

    redis_conn = Redis.from_url(settings.redis_url)
    queue = Queue(settings.worker_queue_name, connection=redis_conn)

    logger.info(f"Worker listening on queue: {settings.worker_queue_name}")
    worker = Worker([queue], connection=redis_conn)
    worker.work(with_scheduler=False)


if __name__ == "__main__":
    run_worker()
