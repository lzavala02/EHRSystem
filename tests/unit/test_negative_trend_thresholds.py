"""Unit tests for configurable negative-trend threshold detection and quick-share flow."""

from datetime import datetime, timedelta, timezone

import pytest

from ehrsystem.alerts import ProviderAlertService
from ehrsystem.symptoms import SymptomLoggingService


@pytest.fixture
def symptom_service():
    """Create a fresh SymptomLoggingService for each test."""
    return SymptomLoggingService()


@pytest.fixture
def alert_service():
    """Create a fresh ProviderAlertService for each test."""
    return ProviderAlertService()


class TestNegativeTrendSeverityIncrease:
    """Tests for severity increase threshold detection."""

    def test_detects_severity_increase_above_threshold(self, symptom_service):
        """Verify negative trend detected when severity increases above threshold."""
        now = datetime.now(timezone.utc)
        period_start = now - timedelta(days=7)
        period_end = now

        # Log with baseline severity 3
        symptom_service.log_symptom(
            patient_id="pat-1",
            symptom_description="Itching and plaques on skin",
            severity_scale=3,
        )
        symptom_service._symptom_logs_by_patient["pat-1"][0].log_date = (
            period_start + timedelta(days=1)
        )

        # Log with worsened severity 6
        symptom_service.log_symptom(
            patient_id="pat-1",
            symptom_description="Severe itching and widespread plaques",
            severity_scale=6,
        )
        symptom_service._symptom_logs_by_patient["pat-1"][1].log_date = period_end

        result = symptom_service.detect_negative_trend_severity_increase(
            patient_id="pat-1",
            period_start=period_start,
            period_end=period_end,
            severity_increase_threshold=2,
        )

        assert result["detected"] is True
        assert result["baseline_severity"] == 3
        assert result["current_severity"] == 6
        assert result["increase"] == 3
        assert result["threshold"] == 2

    def test_does_not_detect_when_increase_below_threshold(self, symptom_service):
        """Verify no alert when severity increase is below threshold."""
        now = datetime.now(timezone.utc)
        period_start = now - timedelta(days=7)
        period_end = now

        symptom_service.log_symptom(
            patient_id="pat-1",
            symptom_description="Mild itching",
            severity_scale=3,
        )
        symptom_service._symptom_logs_by_patient["pat-1"][0].log_date = (
            period_start + timedelta(days=1)
        )

        symptom_service.log_symptom(
            patient_id="pat-1",
            symptom_description="Slightly worse itching",
            severity_scale=4,
        )
        symptom_service._symptom_logs_by_patient["pat-1"][1].log_date = period_end

        result = symptom_service.detect_negative_trend_severity_increase(
            patient_id="pat-1",
            period_start=period_start,
            period_end=period_end,
            severity_increase_threshold=2,
        )

        assert result["detected"] is False
        assert result["increase"] == 1

    def test_handles_insufficient_data_gracefully(self, symptom_service):
        """Verify function handles cases with fewer than 2 entries."""
        now = datetime.now(timezone.utc)
        period_start = now - timedelta(days=7)
        period_end = now

        symptom_service.log_symptom(
            patient_id="pat-1",
            symptom_description="Single entry",
            severity_scale=5,
        )

        result = symptom_service.detect_negative_trend_severity_increase(
            patient_id="pat-1",
            period_start=period_start,
            period_end=period_end,
            severity_increase_threshold=2,
        )

        assert result["detected"] is False
        assert result["reason"] == "insufficient_data"

    def test_handles_positive_trend_correctly(self, symptom_service):
        """Verify severity decrease is not flagged as negative trend."""
        now = datetime.now(timezone.utc)
        period_start = now - timedelta(days=7)
        period_end = now

        symptom_service.log_symptom(
            patient_id="pat-1",
            symptom_description="Severe symptoms",
            severity_scale=8,
        )
        symptom_service._symptom_logs_by_patient["pat-1"][0].log_date = (
            period_start + timedelta(days=1)
        )

        symptom_service.log_symptom(
            patient_id="pat-1",
            symptom_description="Improved symptoms",
            severity_scale=3,
        )
        symptom_service._symptom_logs_by_patient["pat-1"][1].log_date = period_end

        result = symptom_service.detect_negative_trend_severity_increase(
            patient_id="pat-1",
            period_start=period_start,
            period_end=period_end,
            severity_increase_threshold=2,
        )

        assert result["detected"] is False
        assert result["increase"] == -5


class TestConsecutiveHighSeverity:
    """Tests for consecutive high-severity logs detection."""

    def test_detects_consecutive_high_severity_above_threshold(self, symptom_service):
        """Verify alert triggered when consecutive high-severity entries exceed threshold."""
        now = datetime.now(timezone.utc)
        period_start = now - timedelta(days=7)
        period_end = now

        # Log 4 consecutive high-severity entries
        for i in range(4):
            symptom_service.log_symptom(
                patient_id="pat-1",
                symptom_description="Severe flare with widespread lesions",
                severity_scale=8,
            )
            symptom_service._symptom_logs_by_patient["pat-1"][i].log_date = (
                period_start + timedelta(days=i)
            )

        result = symptom_service.detect_consecutive_high_severity(
            patient_id="pat-1",
            period_start=period_start,
            period_end=period_end,
            consecutive_high_threshold=3,
            high_severity_min=7,
        )

        assert result["detected"] is True
        assert result["consecutive_high_count"] == 4
        assert result["total_logs"] == 4

    def test_does_not_detect_when_below_threshold(self, symptom_service):
        """Verify no alert when consecutive high entries below threshold."""
        now = datetime.now(timezone.utc)
        period_start = now - timedelta(days=7)
        period_end = now

        # Log 2 high-severity, then low-severity, then 1 high-severity
        for i, severity in enumerate([8, 8, 3, 8]):
            symptom_service.log_symptom(
                patient_id="pat-1",
                symptom_description="Variable symptoms",
                severity_scale=severity,
            )
            symptom_service._symptom_logs_by_patient["pat-1"][i].log_date = (
                period_start + timedelta(days=i)
            )

        result = symptom_service.detect_consecutive_high_severity(
            patient_id="pat-1",
            period_start=period_start,
            period_end=period_end,
            consecutive_high_threshold=3,
            high_severity_min=7,
        )

        assert result["detected"] is False
        assert result["consecutive_high_count"] == 2  # Maximum consecutive is 2

    def test_handles_empty_patient_gracefully(self, symptom_service):
        """Verify function handles patients with no logs."""
        now = datetime.now(timezone.utc)
        period_start = now - timedelta(days=7)
        period_end = now

        result = symptom_service.detect_consecutive_high_severity(
            patient_id="nonexistent",
            period_start=period_start,
            period_end=period_end,
            consecutive_high_threshold=3,
        )

        assert result["detected"] is False
        assert result["consecutive_high_count"] == 0
        assert result["total_logs"] == 0


class TestHighSeverityPercentage:
    """Tests for high-severity percentage detection."""

    def test_detects_high_severity_percentage_above_threshold(self, symptom_service):
        """Verify alert when high-severity percentage exceeds threshold."""
        now = datetime.now(timezone.utc)
        period_start = now - timedelta(days=7)
        period_end = now

        # Log 5 entries: 3 high-severity (60%) and 2 low-severity (40%)
        severities = [8, 3, 8, 2, 8]
        for i, severity in enumerate(severities):
            symptom_service.log_symptom(
                patient_id="pat-1",
                symptom_description="Mixed severity symptoms",
                severity_scale=severity,
            )
            symptom_service._symptom_logs_by_patient["pat-1"][i].log_date = (
                period_start + timedelta(days=i)
            )

        result = symptom_service.detect_high_severity_percentage(
            patient_id="pat-1",
            period_start=period_start,
            period_end=period_end,
            percentage_threshold=0.25,
            high_severity_min=7,
        )

        assert result["detected"] is True
        assert result["high_severity_count"] == 3
        assert result["high_severity_percentage"] == 0.6
        assert result["total_logs"] == 5

    def test_does_not_detect_when_below_threshold(self, symptom_service):
        """Verify no alert when high-severity percentage below threshold."""
        now = datetime.now(timezone.utc)
        period_start = now - timedelta(days=7)
        period_end = now

        # Log 5 entries: 1 high-severity (20%) and 4 low-severity (80%)
        severities = [8, 3, 2, 4, 3]
        for i, severity in enumerate(severities):
            symptom_service.log_symptom(
                patient_id="pat-1",
                symptom_description="Mostly mild symptoms",
                severity_scale=severity,
            )
            symptom_service._symptom_logs_by_patient["pat-1"][i].log_date = (
                period_start + timedelta(days=i)
            )

        result = symptom_service.detect_high_severity_percentage(
            patient_id="pat-1",
            period_start=period_start,
            period_end=period_end,
            percentage_threshold=0.25,
            high_severity_min=7,
        )

        assert result["detected"] is False
        assert result["high_severity_count"] == 1
        assert result["high_severity_percentage"] == 0.2


class TestThresholdAlertsCreation:
    """Tests for threshold-based alert creation."""

    def test_creates_alert_for_severity_increase(self, alert_service):
        """Verify alert created when severity increase exceeds threshold."""
        analysis = {
            "detected": True,
            "baseline_severity": 3,
            "current_severity": 6,
            "increase": 3,
            "threshold": 2,
        }

        alert = alert_service.evaluate_negative_trend_threshold(
            patient_id="pat-1",
            provider_id="prov-1",
            trend_analysis=analysis,
        )

        assert alert is not None
        assert alert.alert_type == "NegativeTrend"
        assert alert.patient_id == "pat-1"
        assert alert.provider_id == "prov-1"
        assert "3 points" in alert.description
        assert "threshold of 2" in alert.description

    def test_creates_alert_for_consecutive_high(self, alert_service):
        """Verify alert created when consecutive high entries exceed threshold."""
        analysis = {
            "detected": True,
            "consecutive_high_count": 4,
            "total_logs": 4,
            "threshold": 3,
        }

        alert = alert_service.evaluate_negative_trend_threshold(
            patient_id="pat-1",
            provider_id="prov-1",
            trend_analysis=analysis,
        )

        assert alert is not None
        assert alert.alert_type == "NegativeTrend"
        assert "4 consecutive high-severity" in alert.description

    def test_creates_alert_for_high_percentage(self, alert_service):
        """Verify alert created when high-severity percentage exceeds threshold."""
        analysis = {
            "detected": True,
            "high_severity_percentage": 0.6,
            "high_severity_count": 3,
            "total_logs": 5,
            "threshold": 0.25,
        }

        alert = alert_service.evaluate_negative_trend_threshold(
            patient_id="pat-1",
            provider_id="prov-1",
            trend_analysis=analysis,
        )

        assert alert is not None
        assert alert.alert_type == "NegativeTrend"
        assert "60.0%" in alert.description
        assert "25.0%" in alert.description

    def test_returns_none_when_threshold_not_exceeded(self, alert_service):
        """Verify no alert created when threshold not exceeded."""
        analysis = {
            "detected": False,
            "baseline_severity": 3,
            "current_severity": 4,
            "increase": 1,
            "threshold": 2,
        }

        alert = alert_service.evaluate_negative_trend_threshold(
            patient_id="pat-1",
            provider_id="prov-1",
            trend_analysis=analysis,
        )

        assert alert is None


class TestQuickShareDecision:
    """Tests for determining when to quick-share to PCP."""

    def test_should_quick_share_when_any_threshold_exceeded(self, alert_service):
        """Verify quick-share flag set when any threshold is exceeded."""
        analyses = [
            {"detected": False, "threshold": 2},  # No detection
            {"detected": True, "threshold": 3},  # Detection!
            {"detected": False, "threshold": 0.25},  # No detection
        ]

        should_share = alert_service.should_quick_share_to_pcp(analyses)
        assert should_share is True

    def test_should_not_quick_share_when_no_threshold_exceeded(self, alert_service):
        """Verify quick-share flag not set when all thresholds within limits."""
        analyses = [
            {"detected": False, "threshold": 2},
            {"detected": False, "threshold": 3},
            {"detected": False, "threshold": 0.25},
        ]

        should_share = alert_service.should_quick_share_to_pcp(analyses)
        assert should_share is False


class TestEndToEndThresholdWorkflow:
    """Integration tests for complete threshold workflow."""

    def test_complete_negative_trend_detection_and_alert_workflow(
        self, symptom_service, alert_service
    ):
        """Test complete flow from symptom logging to alert generation."""
        now = datetime.now(timezone.utc)
        period_start = now - timedelta(days=7)
        period_end = now

        # Simulate patient logging worsening symptoms over time
        # More consistent high-severity entries to trigger consecutive threshold
        for i, severity in enumerate([3, 4, 7, 8, 8, 8]):
            symptom_service.log_symptom(
                patient_id="pat-1",
                symptom_description="Worsening psoriasis flare",
                severity_scale=severity,
            )
            symptom_service._symptom_logs_by_patient["pat-1"][i].log_date = (
                period_start + timedelta(days=i)
            )

        # Run all threshold analyses
        severity_increase = symptom_service.detect_negative_trend_severity_increase(
            patient_id="pat-1",
            period_start=period_start,
            period_end=period_end,
            severity_increase_threshold=2,
        )

        consecutive_high = symptom_service.detect_consecutive_high_severity(
            patient_id="pat-1",
            period_start=period_start,
            period_end=period_end,
            consecutive_high_threshold=3,
            high_severity_min=7,
        )

        percentage = symptom_service.detect_high_severity_percentage(
            patient_id="pat-1",
            period_start=period_start,
            period_end=period_end,
            percentage_threshold=0.25,
            high_severity_min=7,
        )

        # Verify all analyses detected the negative trend
        assert severity_increase["detected"] is True
        assert consecutive_high["detected"] is True
        assert percentage["detected"] is True

        # Create alerts for each detection
        alerts_created = []
        for analysis in [severity_increase, consecutive_high, percentage]:
            alert = alert_service.evaluate_negative_trend_threshold(
                patient_id="pat-1",
                provider_id="prov-1",
                trend_analysis=analysis,
            )
            if alert:
                alerts_created.append(alert)

        assert len(alerts_created) == 3
        for alert in alerts_created:
            assert alert.alert_type == "NegativeTrend"
            assert alert.patient_id == "pat-1"

        # Verify quick-share should be triggered
        should_share = alert_service.should_quick_share_to_pcp(
            [severity_increase, consecutive_high, percentage]
        )
        assert should_share is True
