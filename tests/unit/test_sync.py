"""Unit tests for cross-system synchronization."""

from datetime import datetime, timezone

from ehrsystem.alerts import ProviderAlertService
from ehrsystem.models import MedicalRecordItem
from ehrsystem.sync import (
    CrossSystemSyncService,
    EpicAdapter,
    FHIRAdapter,
    HL7Adapter,
    NextGenAdapter,
)


def test_sync_service_detects_conflicts_and_tracks_last_synced() -> None:
    """Verify pull, conflict detection, and sync timestamps behave as expected."""

    local_record = MedicalRecordItem(
        record_id="local-1",
        patient_id="pat-1",
        system_id=None,
        category="Medications",
        value_description="Aspirin",
        recorded_at=datetime(2026, 4, 1, tzinfo=timezone.utc),
    )
    remote_record = MedicalRecordItem(
        record_id="remote-1",
        patient_id="pat-1",
        system_id="system-1",
        category="Medications",
        value_description="Ibuprofen",
        recorded_at=datetime(2026, 4, 2, tzinfo=timezone.utc),
    )
    adapter = FHIRAdapter(system_name="Epic", records=[remote_record])
    service = CrossSystemSyncService(adapters=[adapter], local_records=[local_record])

    pulled_records = service.pull_remote_changes("pat-1")
    conflicts = service.detect_conflicts("pat-1")
    sync_status = service.get_last_synced_status("pat-1")

    assert len(pulled_records) == 1
    assert len(conflicts) == 1
    assert conflicts[0].system_name == "Epic"
    assert sync_status[0].category == "Medications"
    assert sync_status[0].last_synced_at is not None
    assert sync_status[0].last_synced_at.tzinfo == timezone.utc


def test_sync_service_pushes_local_records_to_remote_snapshot() -> None:
    """Verify the local repository can be pushed to a remote adapter snapshot."""

    local_record = MedicalRecordItem(
        record_id="local-2",
        patient_id="pat-2",
        system_id=None,
        category="Labs",
        value_description="Normal",
        recorded_at=datetime(2026, 4, 3, tzinfo=timezone.utc),
    )
    adapter = HL7Adapter(system_name="NextGen")
    service = CrossSystemSyncService(adapters=[adapter], local_records=[local_record])

    service.push_local_changes("pat-2")

    assert adapter.pull_remote_changes("pat-2")[0].value_description == "Normal"


def test_sync_service_pushes_bidirectionally_to_epic_and_nextgen() -> None:
    """Verify Day 5 base adapters both receive local records during a push."""

    local_record = MedicalRecordItem(
        record_id="local-5",
        patient_id="pat-5",
        system_id=None,
        category="Diagnoses",
        value_description="Psoriasis",
        recorded_at=datetime(2026, 4, 7, tzinfo=timezone.utc),
    )
    epic_adapter = EpicAdapter()
    nextgen_adapter = NextGenAdapter()
    service = CrossSystemSyncService(
        adapters=[epic_adapter, nextgen_adapter],
        local_records=[local_record],
    )

    service.push_local_changes("pat-5")

    assert epic_adapter.pull_remote_changes("pat-5")[0].category == "Diagnoses"
    assert nextgen_adapter.pull_remote_changes("pat-5")[0].category == "Diagnoses"


def test_sync_service_exposes_sync_metadata_projection() -> None:
    """Verify sync metadata records reflect patient/category freshness in UTC."""

    local_record = MedicalRecordItem(
        record_id="local-3",
        patient_id="pat-3",
        system_id="sys-local",
        category="Allergies",
        value_description="Penicillin",
        recorded_at=datetime(2026, 4, 5, tzinfo=timezone.utc),
    )
    remote_record = MedicalRecordItem(
        record_id="remote-3",
        patient_id="pat-3",
        system_id="sys-epic",
        category="Allergies",
        value_description="Penicillin",
        recorded_at=datetime(2026, 4, 6, tzinfo=timezone.utc),
    )
    adapter = FHIRAdapter(system_name="Epic", records=[remote_record])
    service = CrossSystemSyncService(adapters=[adapter], local_records=[local_record])

    service.pull_remote_changes("pat-3")
    metadata_rows = service.get_sync_metadata_records("pat-3")

    assert len(metadata_rows) == 1
    assert metadata_rows[0].patient_id == "pat-3"
    assert metadata_rows[0].category == "Allergies"
    assert metadata_rows[0].system_id == "sys-epic"
    assert metadata_rows[0].last_synced_at.tzinfo == timezone.utc


def test_sync_patient_bidirectional_generates_provider_conflict_alerts() -> None:
    """Verify conflicts produce provider-facing alerts through the alert service."""

    local_record = MedicalRecordItem(
        record_id="local-4",
        patient_id="pat-4",
        system_id=None,
        category="Medications",
        value_description="Aspirin",
        recorded_at=datetime(2026, 4, 4, tzinfo=timezone.utc),
    )
    remote_record = MedicalRecordItem(
        record_id="remote-4",
        patient_id="pat-4",
        system_id="sys-epic",
        category="Medications",
        value_description="Ibuprofen",
        recorded_at=datetime(2026, 4, 5, tzinfo=timezone.utc),
    )
    service = CrossSystemSyncService(
        adapters=[EpicAdapter(records=[remote_record])],
        local_records=[local_record],
    )
    alert_service = ProviderAlertService()

    pulled, conflicts, alerts = service.sync_patient_bidirectional(
        "pat-4",
        alert_service=alert_service,
    )

    assert len(pulled) == 1
    assert len(conflicts) == 1
    assert len(alerts) == 1
    assert alerts[0].alert_type == "Data Conflict"
    assert alerts[0].system_id == "sys-epic"
