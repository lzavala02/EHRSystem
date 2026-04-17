"""Background worker process bootstrap for Day 1 queue setup."""

from __future__ import annotations

from redis import Redis
from rq import Connection, Queue, Worker

from .config import load_settings


def run_worker() -> None:
    """Start the worker and listen to the configured queue."""

    settings = load_settings()
    redis_conn = Redis.from_url(settings.redis_url)
    queue = Queue(settings.worker_queue_name)

    with Connection(redis_conn):
        worker = Worker([queue])
        worker.work(with_scheduler=False)


if __name__ == "__main__":
    run_worker()
