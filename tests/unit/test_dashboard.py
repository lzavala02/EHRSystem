"""Unit tests for the unified chronic disease dashboard."""

from datetime import datetime, timezone

from ehrsystem.dashboard import UnifiedChronicDiseaseDashboardService
from ehrsystem.models import MedicalRecordItem, Patient, Provider


def test_dashboard_service_aggregates_multi_source_history_and_flags_missing_data() -> (
    None
):
    """Verify the dashboard combines providers, history, and missing fields."""

    patient = Patient(
        patient_id="pat-1",
        full_name="Jordan Patient",
        height=None,
        weight=70.5,
        family_history=None,
        vaccination_record="Up to date",
        primary_provider_id="prov-pcp",
    )
    providers = [
        Provider(
            provider_id="prov-pcp",
            name="Dr. Primary",
            specialty="PCP",
            clinic_affiliation="North Clinic",
        ),
        Provider(
            provider_id="prov-derm",
            name="Dr. Skin",
            specialty="Dermatology",
            clinic_affiliation="Derm Center",
        ),
    ]
    records = [
        MedicalRecordItem(
            record_id="rec-1",
            patient_id="pat-1",
            system_id="sys-epic",
            category="Medications",
            value_description="Aspirin",
            recorded_at=datetime(2026, 4, 1, tzinfo=timezone.utc),
        ),
        MedicalRecordItem(
            record_id="rec-2",
            patient_id="pat-1",
            system_id="sys-nextgen",
            category="Labs",
            value_description="Normal",
            recorded_at=datetime(2026, 4, 2, tzinfo=timezone.utc),
        ),
    ]
    service = UnifiedChronicDiseaseDashboardService(
        patients=[patient],
        providers=providers,
        medical_records=records,
        care_team_by_patient={"pat-1": ["prov-derm"]},
    )

    snapshot = service.build_dashboard("pat-1")

    assert {provider.provider_name for provider in snapshot.providers} == {
        "Dr. Primary",
        "Dr. Skin",
    }
    assert len(snapshot.medical_history) == 2
    assert {field.field_name for field in snapshot.missing_data} == {
        "Height",
        "Family History",
    }
