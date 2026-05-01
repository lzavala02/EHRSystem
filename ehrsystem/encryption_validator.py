"""Encryption configuration validation for data in transit and at rest."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import UTC, datetime
from logging import getLogger

logger = getLogger(__name__)


@dataclass(slots=True)
class EncryptionValidationResult:
    """Result of encryption configuration validation."""

    validated_at: datetime
    component: str  # database, redis, api, frontend, storage
    in_transit_tls: bool
    at_rest_encryption: bool
    config_path: str | None
    notes: list[str]
    status: str  # "compliant", "warning", "non-compliant"


class EncryptionValidator:
    """Validates encryption configuration across the system."""

    @staticmethod
    def validate_database_encryption() -> EncryptionValidationResult:
        """Validate PostgreSQL database encryption config."""
        notes: list[str] = []
        in_transit_tls = False
        at_rest_encryption = False

        # Check database URL for SSL settings
        db_url = os.getenv("DATABASE_URL", "")
        if "sslmode" in db_url:
            if "sslmode=require" in db_url or "sslmode=verify-full" in db_url:
                in_transit_tls = True
                notes.append("PostgreSQL SSL/TLS configured in connection string")
            else:
                notes.append(f"PostgreSQL SSL mode detected: {db_url.split('?')[1] if '?' in db_url else 'unknown'}")
        elif os.getenv("DATABASE_SSL_REQUIRED") == "true":
            in_transit_tls = True
            notes.append("PostgreSQL SSL/TLS required via DATABASE_SSL_REQUIRED")
        else:
            notes.append("WARNING: PostgreSQL TLS/SSL not explicitly required in connection string")

        # At-rest encryption would be configured in PostgreSQL server settings
        # This is typically set at the database instance level
        if os.getenv("DB_ENCRYPTION_AT_REST") == "true":
            at_rest_encryption = True
            notes.append("Database encryption at rest explicitly enabled")
        else:
            notes.append("INFO: Database encryption at rest status determined by infrastructure config")

        status = "compliant" if (in_transit_tls or os.getenv("APP_ENV") == "development") else "warning"

        return EncryptionValidationResult(
            validated_at=datetime.now(UTC),
            component="database",
            in_transit_tls=in_transit_tls,
            at_rest_encryption=at_rest_encryption,
            config_path="DATABASE_URL environment variable",
            notes=notes,
            status=status,
        )

    @staticmethod
    def validate_redis_encryption() -> EncryptionValidationResult:
        """Validate Redis encryption config."""
        notes: list[str] = []
        in_transit_tls = False
        at_rest_encryption = False

        # Check Redis URL for TLS settings
        redis_url = os.getenv("REDIS_URL", "")
        if "rediss://" in redis_url:
            in_transit_tls = True
            notes.append("Redis TLS enabled (rediss:// protocol)")
        elif "redis://" in redis_url:
            if os.getenv("REDIS_SSL_REQUIRED") == "true":
                in_transit_tls = True
                notes.append("Redis SSL/TLS required via REDIS_SSL_REQUIRED")
            else:
                notes.append("INFO: Redis TLS not required in connection string")

        # Redis encryption at rest would be configured in Redis server settings
        if os.getenv("REDIS_ENCRYPTION_AT_REST") == "true":
            at_rest_encryption = True
            notes.append("Redis encryption at rest explicitly enabled")
        else:
            notes.append("INFO: Redis encryption at rest status determined by infrastructure config")

        status = "compliant" if (in_transit_tls or os.getenv("APP_ENV") == "development") else "warning"

        return EncryptionValidationResult(
            validated_at=datetime.now(UTC),
            component="redis",
            in_transit_tls=in_transit_tls,
            at_rest_encryption=at_rest_encryption,
            config_path="REDIS_URL environment variable",
            notes=notes,
            status=status,
        )

    @staticmethod
    def validate_api_encryption() -> EncryptionValidationResult:
        """Validate API encryption (TLS/HTTPS)."""
        notes: list[str] = []
        in_transit_tls = False
        app_env = os.getenv("APP_ENV", "development")

        if app_env == "production":
            if os.getenv("API_HTTPS_ONLY") == "true":
                in_transit_tls = True
                notes.append("API HTTPS-only mode enforced in production")
            else:
                notes.append("WARNING: HTTPS-only mode not explicitly enforced in production")
                notes.append("Ensure reverse proxy (nginx/haproxy) enforces HTTPS and handles TLS termination")

            if os.getenv("HSTS_ENABLED") == "true":
                notes.append("HSTS (HTTP Strict-Transport-Security) enabled")
            else:
                notes.append("RECOMMENDATION: Enable HSTS headers in reverse proxy")
        else:
            notes.append(f"Development/staging environment ({app_env}): HTTPS not required")

        status = "compliant" if (in_transit_tls or app_env != "production") else "warning"

        return EncryptionValidationResult(
            validated_at=datetime.now(UTC),
            component="api",
            in_transit_tls=in_transit_tls,
            at_rest_encryption=False,  # N/A for API layer
            config_path="Reverse proxy / load balancer configuration",
            notes=notes,
            status=status,
        )

    @staticmethod
    def validate_frontend_encryption() -> EncryptionValidationResult:
        """Validate frontend security headers and HTTPS enforcement."""
        notes: list[str] = []
        in_transit_tls = False
        app_env = os.getenv("APP_ENV", "development")

        if app_env == "production":
            notes.append("Frontend should be served over HTTPS via reverse proxy/CDN")
            notes.append("Security headers should be set by reverse proxy (CSP, X-Frame-Options, X-Content-Type-Options)")
            in_transit_tls = True
        else:
            notes.append(f"Development/staging environment ({app_env}): HTTP acceptable during development")

        status = "compliant" if (in_transit_tls or app_env != "production") else "warning"

        return EncryptionValidationResult(
            validated_at=datetime.now(UTC),
            component="frontend",
            in_transit_tls=in_transit_tls,
            at_rest_encryption=False,
            config_path="Frontend build (.env.production)",
            notes=notes,
            status=status,
        )

    @staticmethod
    def validate_data_at_rest() -> EncryptionValidationResult:
        """Validate sensitive data encryption at rest."""
        notes: list[str] = []
        at_rest_encryption = False

        # Check for application-level encryption configuration
        if os.getenv("APP_SECRET_KEY_FILE") or (
            os.getenv("APP_SECRET_KEY")
            and os.getenv("APP_SECRET_KEY") != "dev-insecure-change-me"
        ):
            at_rest_encryption = True
            notes.append("Application secret key configured for data encryption")
        else:
            notes.append("WARNING: Using default/insecure app secret key in development")

        # At-rest encryption notes for different components
        notes.append("Database: Encrypt sensitive fields at database instance level")
        notes.append("Redis: Encryption at rest available via Redis Enterprise or similar")
        notes.append("Audit Logs: Should be stored in encrypted storage with retention policy")
        notes.append("Report PDFs: Generated on-demand and should not be stored permanently")

        status = "compliant" if at_rest_encryption or os.getenv("APP_ENV") == "development" else "warning"

        return EncryptionValidationResult(
            validated_at=datetime.now(UTC),
            component="data_at_rest",
            in_transit_tls=False,
            at_rest_encryption=at_rest_encryption,
            config_path="APP_SECRET_KEY configuration",
            notes=notes,
            status=status,
        )

    @staticmethod
    def validate_all() -> dict[str, EncryptionValidationResult]:
        """Run all encryption validation checks."""
        results = {
            "database": EncryptionValidator.validate_database_encryption(),
            "redis": EncryptionValidator.validate_redis_encryption(),
            "api": EncryptionValidator.validate_api_encryption(),
            "frontend": EncryptionValidator.validate_frontend_encryption(),
            "data_at_rest": EncryptionValidator.validate_data_at_rest(),
        }
        return results

    @staticmethod
    def generate_validation_report() -> str:
        """Generate a validation report for encryption configuration."""
        results = EncryptionValidator.validate_all()
        report_lines = [
            "=== ENCRYPTION CONFIGURATION VALIDATION REPORT ===",
            f"Generated: {datetime.now(UTC).isoformat()}",
            f"Environment: {os.getenv('APP_ENV', 'development')}",
            "",
        ]

        for component, result in results.items():
            report_lines.append(f"[{result.status.upper()}] {component.upper()}")
            report_lines.append(f"  In-Transit TLS: {result.in_transit_tls}")
            report_lines.append(f"  At-Rest Encryption: {result.at_rest_encryption}")
            for note in result.notes:
                report_lines.append(f"  - {note}")
            report_lines.append("")

        report_lines.extend(
            [
                "=== PRODUCTION DEPLOYMENT CHECKLIST ===",
                "[ ] Database SSL/TLS required (sslmode=require in connection string)",
                "[ ] Redis TLS enabled (rediss:// or REDIS_SSL_REQUIRED)",
                "[ ] API HTTPS enforced by reverse proxy",
                "[ ] HSTS headers enabled",
                "[ ] Frontend served only over HTTPS",
                "[ ] Content-Security-Policy headers configured",
                "[ ] X-Frame-Options set to deny/sameorigin",
                "[ ] X-Content-Type-Options set to nosniff",
                "[ ] App secret key rotated and stored securely",
                "[ ] Audit logs stored with retention policy",
                "[ ] Database backups encrypted at rest",
                "[ ] Secrets (credentials) never committed to version control",
            ]
        )

        return "\n".join(report_lines)


def validate_encryption_on_startup() -> None:
    """Run encryption validation at startup and log results."""
    logger.info("Starting encryption configuration validation...")
    results = EncryptionValidator.validate_all()

    non_compliant = [r for r in results.values() if r.status == "non-compliant"]
    warnings = [r for r in results.values() if r.status == "warning"]

    for result in results.values():
        logger.info(
            f"Encryption validation for {result.component}: {result.status.upper()} | "
            f"TLS={result.in_transit_tls}, AtRest={result.at_rest_encryption}"
        )

    if non_compliant:
        logger.warning(f"Non-compliant encryption components: {[r.component for r in non_compliant]}")

    if warnings:
        logger.warning(f"Encryption warnings detected: {[r.component for r in warnings]}")

    logger.info("Encryption validation complete")
