"""Unit tests for symptom, trigger, and treatment logging."""

from datetime import datetime, timedelta, timezone

from ehrsystem.fixtures import is_valid_psoriasis_trigger
from ehrsystem.models import Treatment, Trigger
from ehrsystem.symptoms import SymptomLoggingService


def test_symptom_logging_service_creates_trend_report() -> None:
    """Verify symptom logging captures triggers, treatments, and trend output."""

    service = SymptomLoggingService()
    first_log = service.log_symptom("pat-1", "Redness and scales", severity_scale=3)
    second_log = service.log_symptom(
        "pat-1", "Flare-up with joint aches", severity_scale=7
    )

    service.attach_triggers(
        first_log.log_id, [Trigger(trigger_id="t-1", trigger_name="Stress")]
    )
    service.attach_treatments(
        second_log.log_id,
        [
            Treatment(
                treatment_id="tr-1", product_name="Aveeno", treatment_type="Skincare"
            )
        ],
    )

    period_start = datetime.now(timezone.utc) - timedelta(days=1)
    period_end = datetime.now(timezone.utc) + timedelta(days=1)
    report = service.generate_trend_report("pat-1", period_start, period_end)

    assert report.summary.startswith("Negative trend detected")
    assert len(report.symptoms) == 2
    assert report.triggers[0].trigger_name == "Stress"
    assert report.treatments[0].product_name == "Aveeno"


def test_psoriasis_trigger_validation_fixture_is_seed_aligned() -> None:
    """Ensure common psoriasis trigger checks match the seed checklist."""

    assert is_valid_psoriasis_trigger("Stress")
    assert is_valid_psoriasis_trigger("lack of sleep")
    assert is_valid_psoriasis_trigger("  Scented Products  ")
    assert not is_valid_psoriasis_trigger("Unknown Trigger")
