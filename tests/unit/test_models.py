"""Unit tests for the domain records used across the stories."""

from datetime import datetime, timezone

from ehrsystem.models import Patient, Provider, ReportArtifact, SecureMessage


def test_domain_model_fields_hold_story_data() -> None:
    """Verify the patient and provider records keep the expected story fields."""

    provider = Provider(
        provider_id="prov-1",
        name="Dr. Ada",
        specialty="PCP",
        clinic_affiliation="North Clinic",
    )
    patient = Patient(
        patient_id="pat-1",
        full_name="Jordan Patient",
        primary_provider_id=provider.provider_id,
    )

    assert provider.specialty == "PCP"
    assert patient.primary_provider_id == "prov-1"


def test_report_artifact_and_secure_message_fields_hold_story_data() -> None:
    """Verify report and message entities keep Day 2 workflow fields."""

    now = datetime.now(timezone.utc)
    artifact = ReportArtifact(
        artifact_id="artifact-1",
        patient_id="pat-1",
        generated_by_provider_id="prov-1",
        report_type="Symptom Trend Report",
        storage_path="reports/pat-1/symptom-trend-2026-04-17.pdf",
        created_at=now,
    )
    message = SecureMessage(
        message_id="msg-1",
        patient_id="pat-1",
        sender_provider_id="prov-1",
        recipient_provider_id="prov-2",
        message_body="Progress report attached for PCP review.",
        artifact_id=artifact.artifact_id,
        created_at=now,
    )

    assert artifact.report_type == "Symptom Trend Report"
    assert message.artifact_id == "artifact-1"
    assert message.recipient_provider_id == "prov-2"
