"""Unit tests for cross-system synchronization."""

from datetime import datetime, timezone

from ehrsystem.models import MedicalRecordItem
from ehrsystem.sync import CrossSystemSyncService, FHIRAdapter, HL7Adapter


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
