"""Unit tests for the domain records used across the stories."""

from ehrsystem.models import Patient, Provider


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
