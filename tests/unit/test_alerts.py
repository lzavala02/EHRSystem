"""Unit tests for proactive provider alerts and quick-share support."""

from datetime import datetime, timedelta, timezone

from ehrsystem.alerts import ProviderAlertService


def test_provider_alert_service_creates_alerts_and_shared_report() -> None:
    """Verify alert generation, field prefill, and progress report sharing."""

    service = ProviderAlertService(
        previous_visit_fields_by_pair={("pat-1", "prov-1"): {"Medication": "Aspirin"}}
    )

    conflict_alert = service.create_data_conflict_alert(
        "pat-1", "sys-1", "Medication mismatch detected"
    )
    trend_alert = service.create_negative_trend_alert(
        "pat-1", "prov-1", "Symptoms are worsening"
    )
    populated_fields = service.auto_populate_redundant_fields("pat-1", "prov-1")
    share_message = service.quick_share_progress_report("pat-1", "prov-1")

    assert conflict_alert.alert_type == "SyncConflict"
    assert trend_alert.alert_type == "NegativeTrend"
    assert populated_fields == {"Medication": "Aspirin"}
    assert "Progress report shared" in share_message


def test_provider_alert_service_scopes_prefill_by_patient_provider_pair() -> None:
    """Different providers for one patient should not share auto-populated values."""

    service = ProviderAlertService(
        previous_visit_fields_by_pair={
            ("pat-1", "prov-1"): {"message": "For PCP"},
            ("pat-1", "prov-2"): {"message": "For dermatologist"},
        }
    )

    assert service.auto_populate_redundant_fields("pat-1", "prov-1") == {
        "message": "For PCP"
    }
    assert service.auto_populate_redundant_fields("pat-1", "prov-2") == {
        "message": "For dermatologist"
    }


def test_provider_alert_service_keeps_latest_snapshot_by_visit_time() -> None:
    """Older snapshots should not overwrite newer visit-level auto-populate values."""

    service = ProviderAlertService()
    now = datetime.now(timezone.utc)

    service.record_visit_fields(
        "pat-1",
        "prov-1",
        {"message": "newest"},
        visited_at=now,
    )
    service.record_visit_fields(
        "pat-1",
        "prov-1",
        {"message": "older"},
        visited_at=now - timedelta(hours=1),
    )

    assert service.auto_populate_redundant_fields("pat-1", "prov-1") == {
        "message": "newest"
    }
    assert service.get_last_visit_timestamp("pat-1", "prov-1") == now
