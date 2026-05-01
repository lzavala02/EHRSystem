"""Logging configuration for EHR system with file rotation."""

from __future__ import annotations

import logging
import logging.handlers
from pathlib import Path


def setup_logging(
    log_dir: str = "logs",
    log_file: str = "ehrsystem.log",
    log_level: str = "INFO",
    max_bytes: int = 10 * 1024 * 1024,  # 10 MB
    backup_count: int = 3,
) -> None:
    """Configure logging with rotating file handler.

    Args:
        log_dir: Directory to store log files.
        log_file: Name of the log file.
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL).
        max_bytes: Maximum size of log file before rotation (default: 10 MB).
        backup_count: Number of backup log files to keep (default: 3).
    """
    # Create logs directory if it doesn't exist
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)

    # Get root logger
    logger = logging.getLogger()
    logger.setLevel(log_level)

    # Create rotating file handler
    log_file_path = log_path / log_file
    file_handler = logging.handlers.RotatingFileHandler(
        filename=str(log_file_path),
        maxBytes=max_bytes,
        backupCount=backup_count,
    )
    file_handler.setLevel(log_level)

    # Create console handler for development visibility
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)

    # Create formatter
    formatter = logging.Formatter(
        fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    # Add handlers to logger
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    logger.info(
        f"Logging initialized: file={log_file_path}, "
        f"max_bytes={max_bytes}, backup_count={backup_count}"
    )
