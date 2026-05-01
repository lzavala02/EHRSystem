#!/usr/bin/env python
"""
Example script demonstrating EHRSystem logging capabilities.

This script shows how logging works with file rotation.
Run this to generate sample log entries at different levels.

Usage:
    python examples/logging_demo.py
"""

import logging
import os

import sentry_sdk
from dotenv import load_dotenv

from ehrsystem.config import load_settings
from ehrsystem.logging_config import setup_logging


def main() -> None:
    """Run logging demonstration."""
    # Entry-point bootstrap: load .env before reading runtime settings.
    load_dotenv()
    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN"),
        send_default_pii=False,
        traces_sample_rate=0.0,
        enable_logs=False,
    )

    # Load settings (uses environment variables or defaults)
    settings = load_settings()

    # Initialize logging
    setup_logging(
        log_dir=settings.log_dir,
        log_file=settings.log_file,
        log_level=settings.log_level,
        max_bytes=settings.log_max_bytes,
        backup_count=settings.log_backup_count,
    )

    # Get logger for this module
    logger = logging.getLogger(__name__)

    # Demonstrate different log levels
    logger.debug("This is a DEBUG message - useful for diagnosing problems")
    logger.info("This is an INFO message - confirms things are working")
    logger.warning("This is a WARNING message - something unexpected occurred")
    logger.error("This is an ERROR message - a serious problem occurred")
    logger.critical("This is a CRITICAL message - system failure")

    # Demonstrate logging with context
    logger.info(
        "Simulating user registration: user_id=user-example-123, email=demo@example.com, role=Patient"
    )
    logger.info(
        "Simulating successful login: user_id=user-example-123, challenge_id=challenge-abc789"
    )
    logger.info(
        "Simulating 2FA verification: user_id=user-example-123, session_created=2026-04-21T14:36:15Z"
    )

    # Demonstrate logging in a loop (useful for testing rotation)
    logger.info("\n" + "=" * 80)
    logger.info("Generating sample log entries (useful for testing log rotation)...")
    logger.info("=" * 80)
    for i in range(10):
        logger.info(
            f"Sample entry {i + 1}/10: Processing transaction {i + 1} with 100+ bytes of padding to demonstrate file size growth "
            + "x" * 50
        )

    print("\n✓ Logging demonstration complete!")
    print(f"✓ Log files are stored in: {settings.log_dir}/")
    print(
        f"✓ Log file size limit: {settings.log_max_bytes:,} bytes ({settings.log_max_bytes / 1024 / 1024:.1f} MB)"
    )
    print(f"✓ Backup files kept: {settings.log_backup_count}")
    print(f"\nView logs with: cat {settings.log_dir}/{settings.log_file}")


if __name__ == "__main__":
    main()
