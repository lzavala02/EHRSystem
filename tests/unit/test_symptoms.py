"""Unit tests for symptom, trigger, and treatment logging."""

from datetime import datetime, timedelta, timezone

import pytest

from ehrsystem.fixtures import is_valid_psoriasis_trigger
from ehrsystem.models import Treatment, Trigger
from ehrsystem.symptoms import (
    PsoriasisPayload,
    SymptomLoggingService,
    SymptomValidationError,
)


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


def test_validate_psoriasis_payload_rejects_non_psoriasis_description() -> None:
    """Service should enforce psoriasis-oriented symptom descriptions."""

    service = SymptomLoggingService()

    with pytest.raises(SymptomValidationError) as exc_info:
        service.validate_psoriasis_payload(
            PsoriasisPayload(
                symptom_description="Intermittent headache and fatigue",
                severity_scale=4,
                trigger_names=["Stress"],
                otc_treatments=["Hydrocortisone cream"],
            )
        )
    assert "psoriasis-oriented symptoms" in str(exc_info.value)


def test_validate_psoriasis_payload_requires_otc_for_severe_entries() -> None:
    """Service should require treatment entries for higher severity values."""

    service = SymptomLoggingService()

    with pytest.raises(SymptomValidationError) as exc_info:
        service.validate_psoriasis_payload(
            PsoriasisPayload(
                symptom_description="Psoriasis plaque flare and itching on scalp",
                severity_scale=8,
                trigger_names=["Stress"],
                otc_treatments=[],
            )
        )
    assert "severity is 8 or higher" in str(exc_info.value)


def test_get_severity_level_maps_scale_bands() -> None:
    """Numeric severity should map into mild, moderate, and severe labels."""

    service = SymptomLoggingService()

    assert service.get_severity_level(2) == "mild"
    assert service.get_severity_level(6) == "moderate"
    assert service.get_severity_level(9) == "severe"
