"""Enhanced audit logging for security-sensitive actions and compliance."""

from __future__ import annotations

from enum import Enum
from logging import getLogger

logger = getLogger(__name__)


class AuditEventType(str, Enum):
    """Standardized audit event types for security-sensitive actions."""

    # Authentication events
    USER_REGISTERED = "user.registered"
    USER_LOGIN_INITIATED = "user.login_initiated"
    USER_2FA_CHALLENGE_ISSUED = "user.2fa_challenge_issued"
    USER_2FA_VERIFIED = "user.2fa_verified"
    USER_2FA_FAILED = "user.2fa_failed"
    USER_LOGOUT = "user.logout"
    SESSION_EXPIRED = "session.expired"

    # Authorization events
    ACCESS_DENIED = "access.denied"
    ROLE_CHECK_FAILED = "role.check_failed"

    # Consent events
    CONSENT_REQUEST_CREATED = "consent.request_created"
    CONSENT_NOTIFICATION_SENT = "consent.notification_sent"
    CONSENT_APPROVED = "consent.approved"
    CONSENT_DENIED = "consent.denied"
    CONSENT_DOCUMENT_GENERATED = "consent.document_generated"

    # Data access events
    DASHBOARD_ACCESSED = "dashboard.accessed"
    MEDICAL_RECORDS_RETRIEVED = "medical_records.retrieved"
    SYNC_STATUS_RETRIEVED = "sync_status.retrieved"

    # Symptom logging events
    SYMPTOM_LOG_CREATED = "symptom_log.created"
    SYMPTOM_LOG_RETRIEVED = "symptom_log.retrieved"
    TRIGGER_CHECKLIST_RETRIEVED = "trigger_checklist.retrieved"

    # Sync and conflict events
    SYNC_INITIATED = "sync.initiated"
    SYNC_COMPLETED = "sync.completed"
    CONFLICT_DETECTED = "conflict.detected"
    CONFLICT_RESOLVED = "conflict.resolved"
    CONFLICT_ALERTS_RETRIEVED = "conflict_alerts.retrieved"

    # Report and quick-share events
    REPORT_GENERATED = "report.generated"
    REPORT_QUEUED = "report.queued"
    REPORT_RETRIEVED = "report.retrieved"
    REPORT_ACCESSED = "report.accessed"
    REPORT_DOWNLOADED = "report.downloaded"
    REPORT_SHARED = "report.shared"

    # Alert events
    ALERTS_RETRIEVED = "alerts.retrieved"
    ALERTS_RESOLVED = "alerts.resolved"
    NEGATIVE_TREND_ALERT_TRIGGERED = "negative_trend_alert.triggered"
    SYNC_CONFLICT_ALERT_TRIGGERED = "sync_conflict_alert.triggered"

    # System events
    ENCRYPTION_CONFIG_VALIDATED = "encryption_config.validated"
    DEPLOYMENT_INITIATED = "deployment.initiated"
    DEPLOYMENT_COMPLETED = "deployment.completed"


def audit_event_to_log_entry(
    event_type: AuditEventType | str,
    actor_id: str | None,
    target_id: str | None,
    status: str = "success",
    metadata: dict[str, str] | None = None,
) -> str:
    """Convert audit event to structured log entry for compliance retention."""
    metadata = metadata or {}
    log_entry = (
        f"AUDIT | event_type={event_type} | actor_id={actor_id} | "
        f"target_id={target_id} | status={status}"
    )
    if metadata:
        log_entry += f" | metadata={metadata}"
    return log_entry


def log_audit_event(
    event_type: AuditEventType | str,
    actor_id: str | None = None,
    target_id: str | None = None,
    status: str = "success",
    metadata: dict[str, str] | None = None,
) -> None:
    """Log audit event to compliance audit trail."""
    log_entry = audit_event_to_log_entry(
        event_type=event_type,
        actor_id=actor_id,
        target_id=target_id,
        status=status,
        metadata=metadata,
    )
    logger.info(log_entry)
