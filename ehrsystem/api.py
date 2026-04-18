"""HTTP API process for platform health, security baseline, and API scaffolding."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal, TypedDict
from uuid import uuid4

from fastapi import APIRouter, Depends, FastAPI, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from psycopg import connect
from pydantic import BaseModel
from redis import Redis

from .alerts import ProviderAlertService
from .config import load_settings
from .consent import ConsentWorkflowService
from .dashboard import UnifiedChronicDiseaseDashboardService
from .fixtures import PSORIASIS_TRIGGER_CHECKLIST
from .models import (
    MedicalRecordItem,
    Patient,
    Provider,
    Treatment,
    Trigger,
)
from .symptoms import SymptomLoggingService

settings = load_settings()
app = FastAPI(title=settings.app_name)
security = HTTPBearer(auto_error=False)


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


class SymptomLogCreateRequest(BaseModel):
    patient_id: str
    symptom_description: str
    severity_scale: int
    trigger_ids: list[str]
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

MEDICAL_RECORDS = [
    MedicalRecordItem(
        record_id="rec-1",
        patient_id="pat-1",
        system_id="sys-epic",
        category="Medications",
        value_description="Topical corticosteroid",
        recorded_at=datetime(2026, 4, 10, 13, 30, tzinfo=UTC),
    ),
    MedicalRecordItem(
        record_id="rec-2",
        patient_id="pat-1",
        system_id="sys-nextgen",
        category="Labs",
        value_description="Inflammation markers within expected range",
        recorded_at=datetime(2026, 4, 11, 16, 15, tzinfo=UTC),
    ),
    MedicalRecordItem(
        record_id="rec-3",
        patient_id="pat-2",
        system_id="sys-epic",
        category="Diagnoses",
        value_description="Psoriasis flare documented",
        recorded_at=datetime(2026, 4, 9, 9, 0, tzinfo=UTC),
    ),
]
SYSTEM_NAME_BY_ID = {
    "sys-epic": "Epic",
    "sys-nextgen": "NextGen",
}
SYNC_STATUS_BY_PATIENT: dict[str, list[SyncStatusEntry]] = {
    "pat-1": [
        {
            "category": "Medications",
            "last_synced_at": datetime(2026, 4, 12, 8, 0, tzinfo=UTC),
            "system_id": "sys-epic",
            "system_name": "Epic",
        },
        {
            "category": "Labs",
            "last_synced_at": datetime(2026, 4, 12, 8, 15, tzinfo=UTC),
            "system_id": "sys-nextgen",
            "system_name": "NextGen",
        },
    ],
    "pat-2": [
        {
            "category": "Diagnoses",
            "last_synced_at": datetime(2026, 4, 10, 7, 45, tzinfo=UTC),
            "system_id": "sys-epic",
            "system_name": "Epic",
        }
    ],
}

DASHBOARD_SERVICE = UnifiedChronicDiseaseDashboardService(
    patients=PATIENTS,
    providers=PROVIDERS,
    medical_records=MEDICAL_RECORDS,
    care_team_by_patient={"pat-1": ["prov-derm"], "pat-2": []},
)

CONSENT_SERVICE = ConsentWorkflowService()
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

TRIGGER_CHECKLIST: list[Trigger] = [
    Trigger(trigger_id=f"trig-{index}", trigger_name=name)
    for index, name in enumerate(PSORIASIS_TRIGGER_CHECKLIST, start=1)
]
TRIGGER_BY_ID = {trigger.trigger_id: trigger for trigger in TRIGGER_CHECKLIST}
SYMPTOM_SERVICE = SymptomLoggingService(triggers=TRIGGER_CHECKLIST)
SYMPTOM_LOG_PAYLOADS: list[dict[str, object]] = []

ALERT_SERVICE = ProviderAlertService(
    previous_visit_fields_by_patient={
        "pat-1": {"Current Medication": "Topical corticosteroid"}
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

REPORT_JOBS: dict[str, dict[str, object]] = {}
REPORT_METADATA: dict[str, dict[str, str]] = {
    "rep-1": {
        "report_id": "rep-1",
        "patient_id": "pat-1",
        "generated_at": datetime(2026, 4, 12, 10, 0, tzinfo=UTC).isoformat(),
        "secure_url": "https://example.org/reports/rep-1",
    }
}


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


router = APIRouter(tags=["day3-security-scaffold"])


@router.post("/auth/register")
def register_account(payload: RegisterRequest) -> dict[str, str]:
    existing = USERS_BY_EMAIL.get(payload.email.casefold())
    if existing is not None:
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

    return {
        "challenge_id": challenge_id,
        "expires_at": challenge_expires_at.isoformat(),
        "methods": ["totp"],
    }


@router.post("/auth/2fa/verify")
def verify_two_factor(payload: TwoFAVerifyRequest) -> dict[str, str]:
    challenge = CHALLENGES_BY_ID.get(payload.challenge_id)
    if challenge is None or challenge.expires_at <= _utc_now():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Challenge expired or invalid",
        )

    if payload.code != "123456":
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
    return {"requests": requests}


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
    return {
        "request_id": updated.request_id,
        "status": updated.status,
        "responded_at": updated.responded_at.isoformat()
        if updated.responded_at
        else _utc_now().isoformat(),
    }


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
    medical_history = []
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

    return {
        "patient_id": snapshot.patient_id,
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

    return {
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

    if not payload.trigger_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one trigger is required",
        )

    selected_triggers = []
    for trigger_id in payload.trigger_ids:
        trigger = TRIGGER_BY_ID.get(trigger_id)
        if trigger is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unknown trigger_id: {trigger_id}",
            )
        selected_triggers.append(trigger)

    symptom_log = SYMPTOM_SERVICE.log_symptom(
        patient_id=payload.patient_id,
        symptom_description=payload.symptom_description,
        severity_scale=payload.severity_scale,
    )

    SYMPTOM_SERVICE.attach_triggers(symptom_log.log_id, selected_triggers)

    treatment_objects: list[Treatment] = []
    for index, treatment_name in enumerate(payload.otc_treatments, start=1):
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
            "triggers": [
                {
                    "trigger_id": trigger.trigger_id,
                    "trigger_name": trigger.trigger_name,
                }
                for trigger in selected_triggers
            ],
            "otc_treatments": payload.otc_treatments,
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


@router.post("/symptoms/reports/trend")
def create_trend_report(
    payload: TrendReportRequest,
    user: Annotated[UserRecord, Depends(require_roles("Provider", "Admin"))],
) -> dict[str, str]:
    if user.role == "Provider" and user.provider_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Provider profile required"
        )

    _ = SYMPTOM_SERVICE.generate_trend_report(
        patient_id=payload.patient_id,
        period_start=payload.period_start,
        period_end=payload.period_end,
    )

    report_id = f"rep-{uuid4()}"
    created_at = _utc_now().isoformat()
    REPORT_METADATA[report_id] = {
        "report_id": report_id,
        "patient_id": payload.patient_id,
        "generated_at": created_at,
        "secure_url": f"https://example.org/reports/{report_id}",
    }
    REPORT_JOBS[report_id] = {
        "status": "completed",
        "data": {"report_id": report_id},
        "created_at": created_at,
    }

    return {
        "report_id": report_id,
        "status": "pending",
        "created_at": created_at,
        "job_id": report_id,
    }


@router.get("/reports/{report_id}/status")
def get_report_job_status(
    report_id: str,
    _user: Annotated[
        UserRecord, Depends(require_roles("Patient", "Provider", "Admin"))
    ],
) -> dict[str, object]:
    job = REPORT_JOBS.get(report_id)
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
    _user: Annotated[
        UserRecord, Depends(require_roles("Patient", "Provider", "Admin"))
    ],
) -> dict[str, str]:
    report = REPORT_METADATA.get(report_id)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found"
        )
    return report


@router.post("/provider/quick-share")
def quick_share_report(
    payload: QuickShareRequest,
    _user: Annotated[UserRecord, Depends(require_roles("Provider", "Admin"))],
) -> dict[str, str]:
    if payload.report_id not in REPORT_METADATA:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found"
        )

    message = ALERT_SERVICE.quick_share_progress_report(
        patient_id=payload.patient_id,
        provider_id=payload.to_provider_id,
    )
    return {
        "share_id": f"share-{uuid4()}",
        "status": "pending",
        "created_at": _utc_now().isoformat(),
        "message": message,
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
