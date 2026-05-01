"""Domain records used by the chronic disease EHR scaffold.

These dataclasses mirror the data design in ``db/schema.sql`` and the story
documents. They intentionally contain state only; behavior belongs in the
service modules.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

# Core clinical and identity records.


@dataclass(slots=True)
class Provider:
    """Healthcare provider participating in a patient's care team."""

    provider_id: str
    name: str
    specialty: str | None = None
    clinic_affiliation: str | None = None


@dataclass(slots=True)
class Patient:
    """Patient identity and summary demographics used across the stories."""

    patient_id: str
    full_name: str
    height: float | None = None
    weight: float | None = None
    family_history: str | None = None
    vaccination_record: str | None = None
    two_factor_enabled: bool = True
    primary_provider_id: str | None = None


@dataclass(slots=True)
class EHRSystem:
    """Remote EHR source such as Epic or NextGen."""

    system_id: str
    system_name: str
    protocol: str
    last_synced_at: datetime | None = None


@dataclass(slots=True)
class MedicalRecordItem:
    """Atomic record item pulled from or pushed to an external EHR system."""

    record_id: str
    patient_id: str
    system_id: str | None
    category: str
    value_description: str
    recorded_at: datetime


@dataclass(slots=True)
class SyncMetadataRecord:
    """Per-patient/category sync metadata persisted for freshness tracking."""

    patient_id: str
    system_id: str
    category: str
    sync_direction: str
    last_synced_at: datetime
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass(slots=True)
class SymptomLog:
    """Patient-entered symptom observation used for trend reporting."""

    log_id: str
    patient_id: str
    symptom_description: str
    severity_scale: int | None = None
    log_date: datetime | None = None


@dataclass(slots=True)
class Trigger:
    """A condition that can contribute to a symptom flare-up."""

    trigger_id: str
    trigger_name: str


@dataclass(slots=True)
class Treatment:
    """Non-prescription or supportive treatment logged by the patient."""

    treatment_id: str
    product_name: str
    treatment_type: str | None = None


@dataclass(slots=True)
class AccessRequest:
    """Consent request created when one provider needs access to patient data."""

    request_id: str
    patient_id: str
    provider_id: str
    status: str = "Pending"
    authorization_document: str | None = None
    requested_at: datetime | None = None
    responded_at: datetime | None = None


@dataclass(slots=True)
class Alert:
    """Alert raised for conflicts, negative trends, or missing information."""

    alert_id: str
    alert_type: str
    description: str
    patient_id: str | None = None
    provider_id: str | None = None
    system_id: str | None = None
    status: str = "Active"
    created_at: datetime | None = None


@dataclass(slots=True)
class ReportArtifact:
    """Generated report metadata used for secure sharing workflows."""

    artifact_id: str
    patient_id: str
    generated_by_provider_id: str
    report_type: str
    storage_path: str
    period_start: datetime | None = None
    period_end: datetime | None = None
    created_at: datetime | None = None


@dataclass(slots=True)
class SecureMessage:
    """In-app secure message used for consent/report sharing between providers."""

    message_id: str
    patient_id: str
    sender_provider_id: str
    recipient_provider_id: str
    message_body: str
    artifact_id: str | None = None
    created_at: datetime | None = None
    delivered_at: datetime | None = None
    read_at: datetime | None = None


# View-model style records used by the UI-facing services.


@dataclass(slots=True)
class DataCategorySyncStatus:
    """Per-category last synced timestamp shown in the synchronization UI."""

    category: str
    last_synced_at: datetime | None
    system_name: str


@dataclass(slots=True)
class SyncConflict:
    """Represents a local-versus-remote record mismatch detected during sync."""

    patient_id: str
    category: str
    local_value: str
    remote_value: str
    system_name: str
    detected_at: datetime | None = None


@dataclass(slots=True)
class CareTeamMember:
    """Provider entry displayed in the consolidated chronic disease dashboard."""

    provider_id: str
    provider_name: str
    specialty: str | None = None
    clinic_affiliation: str | None = None


@dataclass(slots=True)
class MissingDataField:
    """Field that is empty and should be highlighted to the patient."""

    field_name: str
    reason: str


@dataclass(slots=True)
class DashboardSnapshot:
    """Single dashboard payload combining history, care team, and gaps."""

    patient_id: str
    providers: list[CareTeamMember]
    medical_history: list[MedicalRecordItem]
    missing_data: list[MissingDataField]


@dataclass(slots=True)
class SymptomTrendReport:
    """Output of the symptom trend reporting workflow."""

    patient_id: str
    period_start: datetime
    period_end: datetime
    summary: str
    symptoms: list[SymptomLog]
    triggers: list[Trigger]
    treatments: list[Treatment]
