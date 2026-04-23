"""HTTP API process for platform health, security baseline, and API scaffolding."""

from __future__ import annotations

import logging
import os
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal, TypedDict
from uuid import uuid4

import sentry_sdk
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from psycopg import connect
from pydantic import BaseModel, Field
from redis import Redis

from .alerts import ProviderAlertService
from .config import load_settings
from .consent import ConsentWorkflowService
from .contracts import ensure_list_item_required_keys, ensure_required_keys
from .dashboard import UnifiedChronicDiseaseDashboardService
from .events import InMemoryAuditEventStore, InMemoryNotificationDispatcher
from .fixtures import PSORIASIS_TRIGGER_CHECKLIST
from .logging_config import setup_logging
from .models import (
    AccessRequest,
    MedicalRecordItem,
    Patient,
    Provider,
    Treatment,
    Trigger,
)
from .reports import InMemoryReportService
from .symptoms import PsoriasisPayload, SymptomLoggingService, SymptomValidationError
from .sync import CrossSystemSyncService, EpicAdapter, NextGenAdapter

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
logger.info(f"Starting {settings.app_name} in {settings.app_env} environment")

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
security = HTTPBearer(auto_error=False)

# Serve frontend static files if build exists
frontend_dist_path = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "frontend", "dist"
)
index_html_path = os.path.join(frontend_dist_path, "index.html")


def _utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass(slots=True)
class UserRecord:
    user_id: str
    email: str
    password: str
    name: str
    role: Literal["Patient", "Provider", "Admin"]
    patient_id: str | None = None
    provider_id: str | None = None


@dataclass(slots=True)
class SessionRecord:
    token: str
    user_id: str
    expires_at: datetime


@dataclass(slots=True)
class ChallengeRecord:
    challenge_id: str
    user_id: str
    expires_at: datetime


class SyncStatusEntry(TypedDict):
    category: str
    last_synced_at: datetime
    system_id: str
    system_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    role: Literal["Patient", "Provider"]


class TwoFAVerifyRequest(BaseModel):
    challenge_id: str
    code: str


class ConsentDecisionRequest(BaseModel):
    decision: Literal["Approve", "Deny"]


class ConsentCreateRequest(BaseModel):
    patient_id: str
    reason: str
    provider_id: str | None = None


class SymptomLogCreateRequest(BaseModel):
    patient_id: str
    symptom_description: str = Field(min_length=10, max_length=500)
    severity_scale: int = Field(ge=1, le=10)
    trigger_ids: list[str] = Field(min_length=1)
    otc_treatments: list[str]


class TrendReportRequest(BaseModel):
    patient_id: str
    period_start: datetime
    period_end: datetime


class QuickShareRequest(BaseModel):
    patient_id: str
    from_provider_id: str
    to_provider_id: str
    report_id: str
    message: str | None = None


class SyncConflictResolveRequest(BaseModel):
    category: str
    system_name: str
    resolution: Literal["accept_local", "accept_remote"]


USERS_BY_ID: dict[str, UserRecord] = {
    "user-patient-1": UserRecord(
        user_id="user-patient-1",
        email="patient@example.com",
        password="Passw0rd!",
        name="Jordan Patient",
        role="Patient",
        patient_id="pat-1",
    ),
    "user-provider-1": UserRecord(
        user_id="user-provider-1",
        email="provider@example.com",
        password="Passw0rd!",
        name="Dr. Ada Provider",
        role="Provider",
        provider_id="prov-pcp",
    ),
    "user-admin-1": UserRecord(
        user_id="user-admin-1",
        email="admin@example.com",
        password="Passw0rd!",
        name="Alex Admin",
        role="Admin",
    ),
}
USERS_BY_EMAIL: dict[str, UserRecord] = {
    user.email.casefold(): user for user in USERS_BY_ID.values()
}
CHALLENGES_BY_ID: dict[str, ChallengeRecord] = {}
SESSIONS_BY_TOKEN: dict[str, SessionRecord] = {}


PROVIDERS = [
    Provider(
        provider_id="prov-pcp",
        name="Dr. Ada Provider",
        specialty="Primary Care",
        clinic_affiliation="North Clinic",
    ),
    Provider(
        provider_id="prov-derm",
        name="Dr. Skin Specialist",
        specialty="Dermatology",
        clinic_affiliation="Derm Center",
    ),
]
PROVIDER_BY_ID = {provider.provider_id: provider for provider in PROVIDERS}

PATIENTS = [
    Patient(
        patient_id="pat-1",
        full_name="Jordan Patient",
        height=170.0,
        weight=72.0,
        family_history="Psoriasis",
        vaccination_record="Up to date",
        primary_provider_id="prov-pcp",
    ),
    Patient(
        patient_id="pat-2",
        full_name="Taylor Chronic",
        height=None,
        weight=80.5,
        family_history=None,
        vaccination_record="Pending confirmation",
        primary_provider_id="prov-derm",
    ),
]
PATIENT_BY_ID = {patient.patient_id: patient for patient in PATIENTS}

MOCK_EXTERNAL_SOURCE_RESPONSES: dict[str, list[dict[str, object]]] = {
    "sys-epic": [
        {
            "record_id": "rec-1",
            "patient_id": "pat-1",
            "category": "Medications",
            "value_description": "Topical corticosteroid",
            "recorded_at": datetime(2026, 4, 10, 13, 30, tzinfo=UTC),
        },
        {
            "record_id": "rec-3",
            "patient_id": "pat-2",
            "category": "Diagnoses",
            "value_description": "Psoriasis flare documented",
            "recorded_at": datetime(2026, 4, 9, 9, 0, tzinfo=UTC),
        },
    ],
    "sys-nextgen": [
        {
            "record_id": "rec-2",
            "patient_id": "pat-1",
            "category": "Labs",
            "value_description": "Inflammation markers within expected range",
            "recorded_at": datetime(2026, 4, 11, 16, 15, tzinfo=UTC),
        }
    ],
}


def _build_medical_records_from_mock_sources() -> list[MedicalRecordItem]:
    records: list[MedicalRecordItem] = []
    for system_id, source_items in MOCK_EXTERNAL_SOURCE_RESPONSES.items():
        for source_item in source_items:
            records.append(
                MedicalRecordItem(
                    record_id=str(source_item["record_id"]),
                    patient_id=str(source_item["patient_id"]),
                    system_id=system_id,
                    category=str(source_item["category"]),
                    value_description=str(source_item["value_description"]),
                    recorded_at=source_item["recorded_at"],  # type: ignore[arg-type]
                )
            )
    return records


MEDICAL_RECORDS = _build_medical_records_from_mock_sources()
SYSTEM_NAME_BY_ID = {
    "sys-epic": "Epic",
    "sys-nextgen": "NextGen",
}
SYNC_STATUS_BY_PATIENT: dict[str, list[SyncStatusEntry]] = {}

LOCAL_SYNC_RECORDS: list[MedicalRecordItem] = [
    MedicalRecordItem(
        record_id="local-sync-1",
        patient_id="pat-1",
        system_id=None,
        category="Medications",
        value_description="Hydrocortisone cream",
        recorded_at=datetime(2026, 4, 12, 7, 40, tzinfo=UTC),
    ),
    MedicalRecordItem(
        record_id="local-sync-2",
        patient_id="pat-1",
        system_id=None,
        category="Labs",
        value_description="Inflammation markers within expected range",
        recorded_at=datetime(2026, 4, 12, 7, 35, tzinfo=UTC),
    ),
    MedicalRecordItem(
        record_id="local-sync-3",
        patient_id="pat-2",
        system_id=None,
        category="Diagnoses",
        value_description="Psoriasis flare documented",
        recorded_at=datetime(2026, 4, 9, 8, 45, tzinfo=UTC),
    ),
]
SYNC_SERVICE = CrossSystemSyncService(
    adapters=[
        EpicAdapter(
            records=[item for item in MEDICAL_RECORDS if item.system_id == "sys-epic"]
        ),
        NextGenAdapter(
            records=[
                item for item in MEDICAL_RECORDS if item.system_id == "sys-nextgen"
            ]
        ),
    ],
    local_records=LOCAL_SYNC_RECORDS,
)


def _rebuild_sync_status_cache(patient_id: str) -> None:
    status_rows = SYNC_SERVICE.get_last_synced_status(patient_id)
    metadata_rows = SYNC_SERVICE.get_sync_metadata_records(patient_id)
    system_id_by_category = {row.category: row.system_id for row in metadata_rows}

    SYNC_STATUS_BY_PATIENT[patient_id] = [
        {
            "category": status_row.category,
            "last_synced_at": status_row.last_synced_at or _utc_now(),
            "system_id": system_id_by_category.get(
                status_row.category, "sys-clinic-repository"
            ),
            "system_name": status_row.system_name,
        }
        for status_row in status_rows
    ]


def _build_alert_payload(alert: dict[str, object]) -> dict[str, str]:
    raw_alert_type = str(alert.get("alert_type") or "")
    alert_type_map = {
        "Data Conflict": "SyncConflict",
        "SyncConflict": "SyncConflict",
        "Negative Trend": "NegativeTrend",
        "NegativeTrend": "NegativeTrend",
    }

    return {
        "alert_id": str(alert["alert_id"]),
        "alert_type": alert_type_map.get(raw_alert_type, raw_alert_type),
        "patient_id": str(alert.get("patient_id") or ""),
        "provider_id": str(alert.get("provider_id") or "prov-pcp"),
        "description": str(alert["description"]),
        "status": str(alert.get("status") or "Active"),
        "triggered_at": str(alert["created_at"]),
        "system_id": str(alert.get("system_id") or "sys-unknown"),
    }


def _mark_conflict_alerts_resolved(
    patient_id: str,
    category: str,
    system_name: str,
) -> None:
    category_fragment = category.casefold()
    system_fragment = system_name.casefold()
    for alert_payload in ALERT_PAYLOADS:
        alert_type = str(alert_payload.get("alert_type") or "")
        description = str(alert_payload.get("description") or "")
        if str(alert_payload.get("patient_id") or "") != patient_id:
            continue
        if alert_type not in {"Data Conflict", "SyncConflict"}:
            continue
        description_casefold = description.casefold()
        if (
            category_fragment in description_casefold
            and system_fragment in description_casefold
        ):
            alert_payload["status"] = "Resolved"


DASHBOARD_SERVICE = UnifiedChronicDiseaseDashboardService(
    patients=PATIENTS,
    providers=PROVIDERS,
    medical_records=MEDICAL_RECORDS,
    care_team_by_patient={"pat-1": ["prov-derm"], "pat-2": []},
)

AUDIT_EVENT_STORE = InMemoryAuditEventStore()
NOTIFICATION_DISPATCHER = InMemoryNotificationDispatcher()


def _record_audit_event(
    event_type: str,
    actor_id: str | None,
    target_id: str | None,
    metadata: dict[str, str],
) -> None:
    AUDIT_EVENT_STORE.record_event(
        event_type=event_type,
        actor_id=actor_id,
        target_id=target_id,
        metadata=metadata,
    )


def _dispatch_consent_notification(access_request: AccessRequest) -> None:
    NOTIFICATION_DISPATCHER.send(
        channel="in_app",
        recipient_id=access_request.patient_id,
        subject="New consent request",
        body=(
            "A provider has requested access to your record. "
            "Review and respond in the consent center."
        ),
        metadata={
            "request_id": access_request.request_id,
            "provider_id": access_request.provider_id,
        },
    )


def _generate_authorization_document(access_request: AccessRequest) -> str:
    approved_at = (
        access_request.responded_at.isoformat()
        if access_request.responded_at is not None
        else "Pending"
    )
    return (
        "HIPAA Digital Authorization Document\n"
        f"Request ID: {access_request.request_id}\n"
        f"Patient ID: {access_request.patient_id}\n"
        f"Provider ID: {access_request.provider_id}\n"
        f"Approved At: {approved_at}\n"
        "Document Service: internal-consent-docs-v1\n"
        "This document records patient-approved access to protected health information."
    )


CONSENT_SERVICE = ConsentWorkflowService(
    audit_recorder=_record_audit_event,
    notification_sender=_dispatch_consent_notification,
    document_generator=_generate_authorization_document,
)
CONSENT_REQUEST_METADATA: dict[str, dict[str, str]] = {}

for patient_id, provider_id, reason in [
    ("pat-1", "prov-derm", "Dermatology consult follow-up"),
    ("pat-1", "prov-pcp", "Primary care medication reconciliation"),
]:
    seeded_request = CONSENT_SERVICE.create_access_request(patient_id, provider_id)
    provider = PROVIDER_BY_ID[provider_id]
    CONSENT_REQUEST_METADATA[seeded_request.request_id] = {
        "provider_name": provider.name,
        "provider_specialty": provider.specialty or "Unknown",
        "reason": reason,
    }
    CONSENT_SERVICE.notify_patient(seeded_request.request_id)

TRIGGER_CHECKLIST: list[Trigger] = [
    Trigger(trigger_id=f"trig-{index}", trigger_name=name)
    for index, name in enumerate(PSORIASIS_TRIGGER_CHECKLIST, start=1)
]
TRIGGER_BY_ID = {trigger.trigger_id: trigger for trigger in TRIGGER_CHECKLIST}
SYMPTOM_SERVICE = SymptomLoggingService(triggers=TRIGGER_CHECKLIST)
SYMPTOM_LOG_PAYLOADS: list[dict[str, object]] = []

ALERT_SERVICE = ProviderAlertService(
    previous_visit_fields_by_pair={
        (
            "pat-1",
            "prov-pcp",
        ): {
            "to_provider_id": "prov-derm",
            "message": "Please review latest symptom progression before the next visit.",
            "period_start": datetime(2026, 4, 1, tzinfo=UTC).isoformat(),
            "period_end": datetime(2026, 4, 12, tzinfo=UTC).isoformat(),
        }
    }
)
ALERT_PAYLOADS = [
    {
        "alert_id": "alert-1",
        "alert_type": "SyncConflict",
        "patient_id": "pat-1",
        "provider_id": "prov-pcp",
        "description": "Medication mismatch detected between Epic and NextGen.",
        "status": "Active",
        "triggered_at": datetime(2026, 4, 12, 9, 0, tzinfo=UTC).isoformat(),
    },
    {
        "alert_id": "alert-2",
        "alert_type": "NegativeTrend",
        "patient_id": "pat-1",
        "provider_id": "prov-pcp",
        "description": "Symptom severity trend has worsened over 7 days.",
        "status": "Active",
        "triggered_at": datetime(2026, 4, 12, 9, 30, tzinfo=UTC).isoformat(),
    },
]

for patient in PATIENTS:
    _pulled, _conflicts, generated_alerts = SYNC_SERVICE.sync_patient_bidirectional(
        patient.patient_id,
        alert_service=ALERT_SERVICE,
    )
    _rebuild_sync_status_cache(patient.patient_id)
    ALERT_PAYLOADS.extend(
        _build_alert_payload(
            {
                "alert_id": alert.alert_id,
                "alert_type": alert.alert_type,
                "patient_id": alert.patient_id,
                "provider_id": alert.provider_id,
                "description": alert.description,
                "status": alert.status,
                "created_at": alert.created_at.isoformat()
                if alert.created_at
                else _utc_now().isoformat(),
                "system_id": alert.system_id,
            }
        )
        for alert in generated_alerts
    )

REPORT_JOBS: dict[str, dict[str, object]] = {}
REPORT_METADATA: dict[str, dict[str, str]] = {
    "rep-1": {
        "report_id": "rep-1",
        "patient_id": "pat-1",
        "generated_by_provider_id": "prov-pcp",
        "generated_at": datetime(2026, 4, 12, 10, 0, tzinfo=UTC).isoformat(),
        "secure_url": "",
    }
}
REPORT_ACCESS_TOKENS: dict[str, dict[str, str]] = {}
SECURE_MESSAGE_PAYLOADS: list[dict[str, str]] = []
REPORT_SERVICE = InMemoryReportService(
    jobs_by_report_id=REPORT_JOBS,
    report_metadata_by_id=REPORT_METADATA,
    access_tokens_by_token=REPORT_ACCESS_TOKENS,
)


def _to_session_user_payload(
    user: UserRecord, expires_at: datetime, token: str
) -> dict[str, str]:
    payload: dict[str, str] = {
        "user_id": user.user_id,
        "role": user.role,
        "email": user.email,
        "name": user.name,
        "session_token": token,
        "expires_at": expires_at.isoformat(),
    }
    if user.patient_id:
        payload["patient_id"] = user.patient_id
    if user.provider_id:
        payload["provider_id"] = user.provider_id
    return payload


def _ensure_authenticated(
    credentials: HTTPAuthorizationCredentials | None,
) -> SessionRecord:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token"
        )

    token = credentials.credentials
    session_record = SESSIONS_BY_TOKEN.get(token)
    if session_record is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token"
        )

    if session_record.expires_at <= _utc_now():
        SESSIONS_BY_TOKEN.pop(token, None)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired"
        )

    return session_record


def _current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> UserRecord:
    session_record = _ensure_authenticated(credentials)
    user = USERS_BY_ID.get(session_record.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown user"
        )
    return user


def require_roles(
    *allowed_roles: Literal["Patient", "Provider", "Admin"],
) -> Callable[[UserRecord], UserRecord]:
    def _role_dependency(
        user: Annotated[UserRecord, Depends(_current_user)],
    ) -> UserRecord:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )
        return user

    return _role_dependency


def _user_can_access_report(
    report_metadata: dict[str, str],
    user: UserRecord,
) -> bool:
    if user.role == "Admin":
        return True

    report_patient_id = report_metadata.get("patient_id")
    report_owner_provider_id = report_metadata.get("generated_by_provider_id")

    if user.role == "Patient" and user.patient_id == report_patient_id:
        return True

    if user.role == "Provider":
        if user.provider_id == report_owner_provider_id:
            return True

        for share in SECURE_MESSAGE_PAYLOADS:
            if share.get("report_id") != report_metadata.get("report_id"):
                continue
            if share.get("recipient_provider_id") == user.provider_id:
                return True
            if share.get("sender_provider_id") == user.provider_id:
                return True

    return False


@app.get("/", response_class=FileResponse, response_model=None)
def root():
    """Serve frontend SPA at root."""
    if os.path.exists(index_html_path):
        return FileResponse(index_html_path)
    return {"error": "Frontend build not found. Run: npm run build in frontend/"}


@app.get("/health/live")
def liveness() -> dict[str, str]:
    """Container/process level health check."""

    return {"status": "ok", "service": "api", "environment": settings.app_env}


@app.api_route(
    "/health", methods=["GET", "HEAD"], response_class=Response, response_model=None
)
def health() -> Response:
    """Simple uptime endpoint suitable for external uptime monitors."""

    return Response(content="OK", media_type="text/plain")


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


router = APIRouter(tags=["day3-security-scaffold"])


@router.post("/auth/register")
def register_account(payload: RegisterRequest) -> dict[str, str]:
    existing = USERS_BY_EMAIL.get(payload.email.casefold())
    if existing is not None:
        logger.warning(f"Registration failed: email already exists - {payload.email}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already exists"
        )

    user_id = f"user-{uuid4()}"
    patient_id = f"pat-{uuid4()}" if payload.role == "Patient" else None
    provider_id = f"prov-{uuid4()}" if payload.role == "Provider" else None
    user = UserRecord(
        user_id=user_id,
        email=payload.email,
        password=payload.password,
        name=payload.name,
        role=payload.role,
        patient_id=patient_id,
        provider_id=provider_id,
    )
    USERS_BY_ID[user_id] = user
    USERS_BY_EMAIL[user.email.casefold()] = user

    logger.info(
        f"User registered successfully: user_id={user_id}, "
        f"email={payload.email}, role={payload.role}"
    )

    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "created_at": _utc_now().isoformat(),
    }


@router.post("/auth/login")
def login(payload: LoginRequest) -> dict[str, object]:
    user = USERS_BY_EMAIL.get(payload.email.casefold())
    if user is None or user.password != payload.password:
        logger.warning(f"Login failed: invalid credentials for email {payload.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    challenge_id = str(uuid4())
    challenge_expires_at = _utc_now() + timedelta(minutes=5)
    CHALLENGES_BY_ID[challenge_id] = ChallengeRecord(
        challenge_id=challenge_id,
        user_id=user.user_id,
        expires_at=challenge_expires_at,
    )

    logger.info(
        f"Login successful, 2FA challenge created: "
        f"user_id={user.user_id}, challenge_id={challenge_id}"
    )

    return {
        "challenge_id": challenge_id,
        "expires_at": challenge_expires_at.isoformat(),
        "methods": ["totp"],
    }


@router.post("/auth/2fa/verify")
def verify_two_factor(payload: TwoFAVerifyRequest) -> dict[str, str]:
    challenge = CHALLENGES_BY_ID.get(payload.challenge_id)
    if challenge is None or challenge.expires_at <= _utc_now():
        logger.warning("2FA verification failed: invalid/expired challenge")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Challenge expired or invalid",
        )

    if payload.code != "123456":
        logger.warning(
            f"2FA verification failed: invalid code for user_id={challenge.user_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 2FA code",
        )

    session_token = str(uuid4())
    expires_at = _utc_now() + timedelta(minutes=30)
    SESSIONS_BY_TOKEN[session_token] = SessionRecord(
        token=session_token,
        user_id=challenge.user_id,
        expires_at=expires_at,
    )
    CHALLENGES_BY_ID.pop(payload.challenge_id, None)

    user = USERS_BY_ID[challenge.user_id]

    logger.info(
        f"User authenticated successfully: user_id={user.user_id}, "
        f"role={user.role}, session_expires_at={expires_at.isoformat()}"
    )

    return _to_session_user_payload(user, expires_at, session_token)


@router.post("/auth/logout")
def logout(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> dict[str, str]:
    if credentials is not None:
        SESSIONS_BY_TOKEN.pop(credentials.credentials, None)
    return {"status": "ok"}


@router.get("/consent/requests")
def list_consent_requests(
    user: Annotated[UserRecord, Depends(require_roles("Patient", "Provider", "Admin"))],
) -> dict[str, list[dict[str, str]]]:
    requests: list[dict[str, str]] = []
    for request_id, metadata in CONSENT_REQUEST_METADATA.items():
        access_request = CONSENT_SERVICE._access_requests_by_id.get(request_id)
        if access_request is None:
            continue
        if user.role == "Patient" and user.patient_id != access_request.patient_id:
            continue
        requests.append(
            {
                "request_id": access_request.request_id,
                "patient_id": access_request.patient_id,
                "provider_id": access_request.provider_id,
                "provider_name": metadata["provider_name"],
                "provider_specialty": metadata["provider_specialty"],
                "reason": metadata["reason"],
                "status": access_request.status,
                "requested_at": (
                    access_request.requested_at.isoformat()
                    if access_request.requested_at is not None
                    else _utc_now().isoformat()
                ),
            }
        )
    payload: dict[str, list[dict[str, str]]] = {"requests": requests}
    ensure_required_keys(
        payload,
        required_keys={"requests"},
        context="consent.requests",
    )
    ensure_list_item_required_keys(
        payload["requests"],  # type: ignore[arg-type]
        required_keys={
            "request_id",
            "patient_id",
            "provider_id",
            "provider_name",
            "provider_specialty",
            "reason",
            "status",
            "requested_at",
        },
        context="consent.requests",
    )
    return payload


@router.post("/consent/requests", status_code=status.HTTP_201_CREATED)
def create_consent_request(
    payload: ConsentCreateRequest,
    user: Annotated[UserRecord, Depends(require_roles("Provider", "Admin"))],
) -> dict[str, str]:
    if payload.patient_id not in PATIENT_BY_ID:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found"
        )

    effective_provider_id = (
        user.provider_id if user.role == "Provider" else payload.provider_id
    )
    if effective_provider_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="provider_id is required",
        )

    provider = PROVIDER_BY_ID.get(effective_provider_id)
    if provider is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found"
        )

    access_request = CONSENT_SERVICE.create_access_request(
        patient_id=payload.patient_id,
        provider_id=effective_provider_id,
    )

    CONSENT_REQUEST_METADATA[access_request.request_id] = {
        "provider_name": provider.name,
        "provider_specialty": provider.specialty or "Unknown",
        "reason": payload.reason.strip() or "Clinical record access request",
    }

    CONSENT_SERVICE.notify_patient(access_request.request_id)

    response_payload = {
        "request_id": access_request.request_id,
        "patient_id": access_request.patient_id,
        "provider_id": access_request.provider_id,
        "provider_name": provider.name,
        "provider_specialty": provider.specialty or "Unknown",
        "reason": CONSENT_REQUEST_METADATA[access_request.request_id]["reason"],
        "status": access_request.status,
        "requested_at": access_request.requested_at.isoformat()
        if access_request.requested_at
        else _utc_now().isoformat(),
    }
    ensure_required_keys(
        response_payload,
        required_keys={
            "request_id",
            "patient_id",
            "provider_id",
            "provider_name",
            "provider_specialty",
            "reason",
            "status",
            "requested_at",
        },
        context="consent.request.create",
    )
    return response_payload


@router.post("/consent/requests/{request_id}/decision")
def decide_consent_request(
    request_id: str,
    payload: ConsentDecisionRequest,
    user: Annotated[UserRecord, Depends(require_roles("Patient", "Admin"))],
) -> dict[str, str]:
    access_request = CONSENT_SERVICE._access_requests_by_id.get(request_id)
    if access_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )
    if user.role == "Patient" and user.patient_id != access_request.patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    updated = CONSENT_SERVICE.respond_to_request(request_id, payload.decision)
    if updated.status == "Approved":
        CONSENT_SERVICE.generate_digital_authorization_document(request_id)

    response_payload = {
        "request_id": updated.request_id,
        "status": updated.status,
        "responded_at": updated.responded_at.isoformat()
        if updated.responded_at
        else _utc_now().isoformat(),
    }
    ensure_required_keys(
        response_payload,
        required_keys={"request_id", "status", "responded_at"},
        context="consent.decision",
    )
    return response_payload


@router.get("/dashboard/patients/{patient_id}")
def get_patient_dashboard(
    patient_id: str,
    user: Annotated[UserRecord, Depends(require_roles("Patient", "Provider", "Admin"))],
) -> dict[str, object]:
    if user.role == "Patient" and user.patient_id != patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    if patient_id not in PATIENT_BY_ID:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found"
        )

    snapshot = DASHBOARD_SERVICE.build_dashboard(patient_id)
    patient = PATIENT_BY_ID[patient_id]
    medical_history: list[dict[str, str]] = []
    for item in snapshot.medical_history:
        medical_history.append(
            {
                "record_id": item.record_id,
                "category": item.category,
                "value_description": item.value_description,
                "recorded_at": item.recorded_at.isoformat(),
                "system_id": item.system_id or "unknown",
                "system_name": SYSTEM_NAME_BY_ID.get(item.system_id or "", "Unknown"),
            }
        )

    source_systems: list[dict[str, str]] = []
    seen_system_ids: set[str] = set()
    for history_item in medical_history:
        system_id = str(history_item["system_id"])
        if system_id in seen_system_ids:
            continue
        seen_system_ids.add(system_id)
        source_systems.append(
            {
                "system_id": system_id,
                "system_name": str(history_item["system_name"]),
            }
        )

    payload: dict[str, object] = {
        "patient_id": snapshot.patient_id,
        "patient_profile": {
            "height": patient.height,
            "weight": patient.weight,
            "vaccination_record": patient.vaccination_record,
            "family_history": patient.family_history,
        },
        "source_systems": source_systems,
        "providers": [
            {
                "provider_id": provider.provider_id,
                "provider_name": provider.provider_name,
                "specialty": provider.specialty or "Unknown",
                "clinic_affiliation": provider.clinic_affiliation or "Unknown",
            }
            for provider in snapshot.providers
        ],
        "medical_history": medical_history,
        "missing_data": [
            {"field_name": field.field_name, "reason": field.reason}
            for field in snapshot.missing_data
        ],
    }
    ensure_required_keys(
        payload,
        required_keys={
            "patient_id",
            "patient_profile",
            "source_systems",
            "providers",
            "medical_history",
            "missing_data",
        },
        context="dashboard.snapshot",
    )
    ensure_required_keys(
        payload["patient_profile"],  # type: ignore[arg-type]
        required_keys={"height", "weight", "vaccination_record", "family_history"},
        context="dashboard.snapshot.patient_profile",
    )
    ensure_list_item_required_keys(
        payload["source_systems"],  # type: ignore[arg-type]
        required_keys={"system_id", "system_name"},
        context="dashboard.snapshot.source_systems",
    )
    ensure_list_item_required_keys(
        payload["providers"],  # type: ignore[arg-type]
        required_keys={
            "provider_id",
            "provider_name",
            "specialty",
            "clinic_affiliation",
        },
        context="dashboard.snapshot.providers",
    )
    ensure_list_item_required_keys(
        payload["medical_history"],  # type: ignore[arg-type]
        required_keys={
            "record_id",
            "category",
            "value_description",
            "recorded_at",
            "system_id",
            "system_name",
        },
        context="dashboard.snapshot.medical_history",
    )
    ensure_list_item_required_keys(
        payload["missing_data"],  # type: ignore[arg-type]
        required_keys={"field_name", "reason"},
        context="dashboard.snapshot.missing_data",
    )
    return payload


@router.get("/dashboard/patients/{patient_id}/sync-status")
def get_patient_dashboard_sync_status(
    patient_id: str,
    user: Annotated[UserRecord, Depends(require_roles("Patient", "Provider", "Admin"))],
) -> dict[str, object]:
    if user.role == "Patient" and user.patient_id != patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    status_entries = SYNC_STATUS_BY_PATIENT.get(patient_id)
    if status_entries is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient sync status not found",
        )

    payload: dict[str, object] = {
        "patient_id": patient_id,
        "sync_status": [
            {
                "category": entry["category"],
                "last_synced_at": entry["last_synced_at"].isoformat(),
                "system_id": entry["system_id"],
                "system_name": entry["system_name"],
            }
            for entry in status_entries
        ],
    }
    ensure_required_keys(
        payload,  # type: ignore[arg-type]
        required_keys={"patient_id", "sync_status"},
        context="dashboard.sync_status",
    )
    ensure_list_item_required_keys(
        payload["sync_status"],  # type: ignore[arg-type]
        required_keys={"category", "last_synced_at", "system_id", "system_name"},
        context="dashboard.sync_status.items",
    )
    return payload


@router.get("/sync/patients/{patient_id}/conflicts")
def list_sync_conflicts(
    patient_id: str,
    user: Annotated[UserRecord, Depends(require_roles("Provider", "Admin"))],
) -> dict[str, object]:
    if user.role == "Provider" and user.provider_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Provider profile required"
        )

    conflicts = SYNC_SERVICE.get_open_conflicts(patient_id)
    return {
        "patient_id": patient_id,
        "conflicts": [
            {
                "category": conflict.category,
                "system_name": conflict.system_name,
                "local_value": conflict.local_value,
                "remote_value": conflict.remote_value,
                "detected_at": (
                    conflict.detected_at.isoformat()
                    if conflict.detected_at is not None
                    else _utc_now().isoformat()
                ),
                "requires_manual_resolution": True,
            }
            for conflict in conflicts
        ],
        "total": len(conflicts),
    }


@router.post("/sync/patients/{patient_id}/conflicts/resolve")
def resolve_sync_conflict(
    patient_id: str,
    payload: SyncConflictResolveRequest,
    user: Annotated[UserRecord, Depends(require_roles("Provider", "Admin"))],
) -> dict[str, str]:
    if user.role == "Provider" and user.provider_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Provider profile required"
        )

    resolved_conflict = SYNC_SERVICE.resolve_conflict(
        patient_id=patient_id,
        category=payload.category,
        system_name=payload.system_name,
        resolution=payload.resolution,
    )
    if resolved_conflict is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sync conflict not found",
        )

    _mark_conflict_alerts_resolved(
        patient_id=patient_id,
        category=payload.category,
        system_name=payload.system_name,
    )
    _rebuild_sync_status_cache(patient_id)

    return {
        "status": "resolved",
        "patient_id": patient_id,
        "category": payload.category,
        "system_name": payload.system_name,
        "resolution": payload.resolution,
    }


@router.get("/symptoms/triggers")
def get_symptom_triggers(
    _user: Annotated[
        UserRecord, Depends(require_roles("Patient", "Provider", "Admin"))
    ],
) -> dict[str, list[dict[str, str]]]:
    return {
        "triggers": [
            {
                "trigger_id": trigger.trigger_id,
                "trigger_name": trigger.trigger_name,
                "category": "Psoriasis",
            }
            for trigger in TRIGGER_CHECKLIST
        ]
    }


@router.post("/symptoms/logs", status_code=status.HTTP_201_CREATED)
def create_symptom_log(
    payload: SymptomLogCreateRequest,
    user: Annotated[UserRecord, Depends(require_roles("Patient", "Admin"))],
) -> dict[str, str]:
    if user.role == "Patient" and user.patient_id != payload.patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    selected_triggers = []
    for trigger_id in payload.trigger_ids:
        trigger = TRIGGER_BY_ID.get(trigger_id)
        if trigger is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Unknown trigger_id: {trigger_id}",
            )
        selected_triggers.append(trigger)

    normalized_otc_treatments = [
        treatment.strip() for treatment in payload.otc_treatments if treatment.strip()
    ]

    try:
        SYMPTOM_SERVICE.validate_psoriasis_payload(
            PsoriasisPayload(
                symptom_description=payload.symptom_description,
                severity_scale=payload.severity_scale,
                trigger_names=[trigger.trigger_name for trigger in selected_triggers],
                otc_treatments=normalized_otc_treatments,
            )
        )
    except SymptomValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc

    symptom_log = SYMPTOM_SERVICE.log_symptom(
        patient_id=payload.patient_id,
        symptom_description=payload.symptom_description.strip(),
        severity_scale=payload.severity_scale,
    )

    SYMPTOM_SERVICE.attach_triggers(symptom_log.log_id, selected_triggers)

    treatment_objects: list[Treatment] = []
    for index, treatment_name in enumerate(normalized_otc_treatments, start=1):
        treatment_objects.append(
            Treatment(
                treatment_id=f"{symptom_log.log_id}-otc-{index}",
                product_name=treatment_name,
                treatment_type="OTC",
            )
        )
    if treatment_objects:
        SYMPTOM_SERVICE.attach_treatments(symptom_log.log_id, treatment_objects)

    SYMPTOM_LOG_PAYLOADS.append(
        {
            "log_id": symptom_log.log_id,
            "patient_id": symptom_log.patient_id,
            "symptom_description": symptom_log.symptom_description,
            "severity_scale": symptom_log.severity_scale,
            "severity_level": SYMPTOM_SERVICE.get_severity_level(
                symptom_log.severity_scale
            ),
            "triggers": [
                {
                    "trigger_id": trigger.trigger_id,
                    "trigger_name": trigger.trigger_name,
                }
                for trigger in selected_triggers
            ],
            "otc_treatments": normalized_otc_treatments,
            "created_at": symptom_log.log_date.isoformat()
            if symptom_log.log_date
            else _utc_now().isoformat(),
        }
    )

    return {
        "log_id": symptom_log.log_id,
        "patient_id": symptom_log.patient_id,
        "created_at": symptom_log.log_date.isoformat()
        if symptom_log.log_date
        else _utc_now().isoformat(),
    }


@router.get("/symptoms/logs")
def list_symptom_logs(
    user: Annotated[UserRecord, Depends(require_roles("Patient", "Provider", "Admin"))],
    patient_id: str | None = None,
) -> dict[str, object]:
    effective_patient_id = patient_id
    if user.role == "Patient":
        effective_patient_id = user.patient_id

    logs = [
        payload
        for payload in SYMPTOM_LOG_PAYLOADS
        if effective_patient_id is None or payload["patient_id"] == effective_patient_id
    ]
    logs.sort(key=lambda item: str(item["created_at"]), reverse=True)

    return {
        "logs": logs,
        "total": len(logs),
        "page": 1,
        "page_size": len(logs),
    }


@router.post("/symptoms/reports/trend", status_code=status.HTTP_202_ACCEPTED)
def create_trend_report(
    payload: TrendReportRequest,
    user: Annotated[UserRecord, Depends(require_roles("Provider", "Admin"))],
) -> dict[str, str]:
    if user.role == "Provider" and user.provider_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Provider profile required"
        )

    trend_report = SYMPTOM_SERVICE.generate_trend_report(
        patient_id=payload.patient_id,
        period_start=payload.period_start,
        period_end=payload.period_end,
    )

    generated_by_provider_id = user.provider_id or "admin"

    ALERT_SERVICE.record_visit_fields(
        patient_id=payload.patient_id,
        provider_id=generated_by_provider_id,
        fields={
            "period_start": payload.period_start.isoformat(),
            "period_end": payload.period_end.isoformat(),
        },
        visited_at=_utc_now(),
    )

    job = REPORT_SERVICE.queue_trend_report(
        patient_id=payload.patient_id,
        generated_by_provider_id=generated_by_provider_id,
        period_start=payload.period_start,
        period_end=payload.period_end,
        summary=trend_report.summary,
    )

    _record_audit_event(
        "report.generated",
        actor_id=user.user_id,
        target_id=str(job["report_id"]),
        metadata={
            "report_id": str(job["report_id"]),
            "patient_id": payload.patient_id,
            "generated_by_provider_id": generated_by_provider_id,
        },
    )

    return {
        "report_id": str(job["report_id"]),
        "status": str(job["status"]),
        "created_at": str(job["created_at"]),
        "job_id": str(job["report_id"]),
    }


@router.get("/reports/{report_id}/status")
def get_report_job_status(
    report_id: str,
    _user: Annotated[
        UserRecord, Depends(require_roles("Patient", "Provider", "Admin"))
    ],
) -> dict[str, object]:
    job = REPORT_SERVICE.get_job(report_id)

    if job is not None and str(job.get("status")) in {"pending", "processing"}:
        job = REPORT_SERVICE.complete_job(report_id)

    if job is None:
        report_metadata = REPORT_SERVICE.get_report_metadata(report_id)
        if report_metadata is not None:
            return {
                "status": "completed",
                "data": {"report_id": report_id},
            }

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report job not found"
        )
    return {
        "status": job["status"],
        "data": job["data"],
    }


@router.get("/reports/{report_id}")
def get_report_metadata(
    report_id: str,
    user: Annotated[UserRecord, Depends(require_roles("Patient", "Provider", "Admin"))],
) -> dict[str, str]:
    report = REPORT_SERVICE.get_report_metadata(report_id)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found"
        )

    if not _user_can_access_report(report, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    secure_access = REPORT_SERVICE.issue_secure_access(
        report_id=report_id,
        viewer_user_id=user.user_id,
    )
    payload = dict(report)
    payload["secure_url"] = (
        f"/v1/reports/{report_id}/content?access_token={secure_access['access_token']}"
    )
    payload["expires_at"] = secure_access["expires_at"]
    return payload


@router.get("/reports/{report_id}/content", response_class=Response)
def get_report_content(
    report_id: str,
    access_token: Annotated[str, Query(min_length=10)],
    user: Annotated[UserRecord, Depends(require_roles("Patient", "Provider", "Admin"))],
) -> Response:
    report = REPORT_SERVICE.get_report_metadata(report_id)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found"
        )

    if not _user_can_access_report(report, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    is_valid = REPORT_SERVICE.consume_secure_access(
        report_id=report_id,
        access_token=access_token,
        viewer_user_id=user.user_id,
    )
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired report access token",
        )

    _record_audit_event(
        "report.accessed",
        actor_id=user.user_id,
        target_id=report_id,
        metadata={"report_id": report_id},
    )
    _record_audit_event(
        "report.downloaded",
        actor_id=user.user_id,
        target_id=report_id,
        metadata={"report_id": report_id},
    )

    return Response(
        content=(
            b"%PDF-1.4\n"
            b"1 0 obj\n"
            b"<< /Type /Catalog >>\n"
            b"endobj\n"
            b"%% Report scaffold content\n"
        ),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename={report_id}.pdf",
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post("/provider/quick-share")
def quick_share_report(
    payload: QuickShareRequest,
    user: Annotated[UserRecord, Depends(require_roles("Provider", "Admin"))],
) -> dict[str, str]:
    report_metadata = REPORT_SERVICE.get_report_metadata(payload.report_id)
    if report_metadata is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found"
        )

    if report_metadata.get("patient_id") != payload.patient_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Report patient_id does not match payload patient_id",
        )

    if user.role == "Provider" and user.provider_id != payload.from_provider_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    prefill_fields = ALERT_SERVICE.auto_populate_redundant_fields(
        patient_id=payload.patient_id,
        provider_id=payload.from_provider_id,
    )
    message_body = (payload.message or "").strip() or str(
        prefill_fields.get("message") or "Progress report shared for review."
    )

    share_id = f"share-{uuid4()}"
    secure_message_payload = {
        "message_id": share_id,
        "patient_id": payload.patient_id,
        "sender_provider_id": payload.from_provider_id,
        "recipient_provider_id": payload.to_provider_id,
        "report_id": payload.report_id,
        "message_body": message_body,
        "created_at": _utc_now().isoformat(),
        "delivered_at": _utc_now().isoformat(),
    }
    SECURE_MESSAGE_PAYLOADS.append(secure_message_payload)

    NOTIFICATION_DISPATCHER.send(
        channel="in_app",
        recipient_id=payload.to_provider_id,
        subject="New secure report share",
        body=secure_message_payload["message_body"],
        metadata={
            "share_id": share_id,
            "report_id": payload.report_id,
            "patient_id": payload.patient_id,
            "from_provider_id": payload.from_provider_id,
        },
    )

    _record_audit_event(
        "report.shared",
        actor_id=user.user_id,
        target_id=payload.report_id,
        metadata={
            "share_id": share_id,
            "from_provider_id": payload.from_provider_id,
            "to_provider_id": payload.to_provider_id,
            "patient_id": payload.patient_id,
        },
    )

    ALERT_SERVICE.record_visit_fields(
        patient_id=payload.patient_id,
        provider_id=payload.from_provider_id,
        fields={
            "to_provider_id": payload.to_provider_id,
            "message": message_body,
            "report_id": payload.report_id,
            "period_start": str(report_metadata.get("period_start") or ""),
            "period_end": str(report_metadata.get("period_end") or ""),
        },
        visited_at=_utc_now(),
    )

    message = ALERT_SERVICE.quick_share_progress_report(
        patient_id=payload.patient_id,
        provider_id=payload.to_provider_id,
    )
    return {
        "share_id": share_id,
        "status": "pending",
        "created_at": _utc_now().isoformat(),
        "message": message,
    }


@router.get("/provider/patients/{patient_id}/quick-share-prefill")
def get_quick_share_prefill(
    patient_id: str,
    user: Annotated[UserRecord, Depends(require_roles("Provider", "Admin"))],
) -> dict[str, object]:
    if user.role == "Provider" and user.provider_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Provider profile required"
        )

    provider_id = user.provider_id or "admin"
    fields = ALERT_SERVICE.auto_populate_redundant_fields(patient_id, provider_id)
    source_timestamp = ALERT_SERVICE.get_last_visit_timestamp(patient_id, provider_id)

    return {
        "patient_id": patient_id,
        "provider_id": provider_id,
        "fields": fields,
        "source_timestamp_utc": source_timestamp.isoformat()
        if source_timestamp
        else None,
    }


@router.get("/provider/quick-share/inbox")
def list_quick_share_inbox(
    user: Annotated[UserRecord, Depends(require_roles("Provider", "Admin"))],
) -> dict[str, object]:
    if user.role == "Admin":
        shares = list(SECURE_MESSAGE_PAYLOADS)
    else:
        shares = [
            message
            for message in SECURE_MESSAGE_PAYLOADS
            if message.get("recipient_provider_id") == user.provider_id
        ]

    return {
        "shares": shares,
        "total": len(shares),
        "page": 1,
        "page_size": len(shares),
    }


@router.get("/provider/patients")
def list_provider_patients(
    _user: Annotated[UserRecord, Depends(require_roles("Provider", "Admin"))],
) -> dict[str, object]:
    return {
        "patients": [
            {
                "patient_id": patient.patient_id,
                "patient_name": patient.full_name,
                "primary_condition": "Psoriasis",
                "last_visit": datetime(2026, 4, 12, 10, 0, tzinfo=UTC).isoformat(),
            }
            for patient in PATIENTS
        ],
        "total": len(PATIENTS),
        "page": 1,
        "page_size": len(PATIENTS),
    }


@router.get("/alerts")
def list_alerts(
    _user: Annotated[UserRecord, Depends(require_roles("Provider", "Admin"))],
) -> dict[str, object]:
    return {
        "alerts": ALERT_PAYLOADS,
        "total": len(ALERT_PAYLOADS),
        "page": 1,
        "page_size": len(ALERT_PAYLOADS),
    }


app.include_router(router, prefix="/v1")
app.include_router(router, prefix="/api/v1")


# Serve frontend for client-side routing
@app.get("/{full_path:path}", response_class=FileResponse, response_model=None)
def serve_frontend(full_path: str):
    """Serve frontend SPA. For unmapped routes, serve index.html for client-side routing."""
    normalized_path = os.path.normpath(full_path).lstrip(os.sep)
    candidate_path = os.path.join(frontend_dist_path, normalized_path)

    if os.path.isfile(candidate_path):
        return FileResponse(candidate_path)

    # SPA fallback only for client-side routes, not for missing JS/CSS assets.
    if "." not in full_path.split("/")[-1] and os.path.exists(index_html_path):
        return FileResponse(index_html_path)

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")
