"""Unit tests for proactive provider alerts and quick-share support."""

from ehrsystem.alerts import ProviderAlertService


def test_provider_alert_service_creates_alerts_and_shared_report() -> None:
    """Verify alert generation, field prefill, and progress report sharing."""

    service = ProviderAlertService(
        previous_visit_fields_by_patient={"pat-1": {"Medication": "Aspirin"}}
    )

    conflict_alert = service.create_data_conflict_alert(
        "pat-1", "sys-1", "Medication mismatch detected"
    )
    trend_alert = service.create_negative_trend_alert(
        "pat-1", "prov-1", "Symptoms are worsening"
    )
    populated_fields = service.auto_populate_redundant_fields("pat-1")
    share_message = service.quick_share_progress_report("pat-1", "prov-1")

    assert conflict_alert.alert_type == "Data Conflict"
    assert trend_alert.alert_type == "Negative Trend"
    assert populated_fields == {"Medication": "Aspirin"}
    assert "Progress report shared" in share_message
