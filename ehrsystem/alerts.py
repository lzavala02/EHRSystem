"""Provider alerting and documentation-assist scaffolding.

This module keeps the proactive alert and quick-share concerns separate from the
rest of the stories so each workflow stays easy to reason about.
"""

from __future__ import annotations

from collections.abc import Mapping
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from .models import Alert


class ProviderAlertService:
    """Creates alerts for negative trends, conflicts, and documentation support."""

    def __init__(
        self,
        previous_visit_fields_by_pair: Mapping[tuple[str, str], dict[str, object]]
        | None = None,
    ) -> None:
        """Store the last known visit values used for auto-population."""

        self._previous_visit_fields_by_pair: dict[
            tuple[str, str], dict[str, object]
        ] = {
            pair_key: deepcopy(fields)
            for pair_key, fields in (previous_visit_fields_by_pair or {}).items()
        }
        self._latest_visit_timestamp_by_pair: dict[tuple[str, str], datetime] = {}
        self._shared_progress_reports: list[str] = []

    def create_data_conflict_alert(
        self, patient_id: str, system_id: str, description: str
    ) -> Alert:
        """Raise the alert that tells a provider sync found a conflict."""

        return Alert(
            alert_id=str(uuid4()),
            alert_type="SyncConflict",
            description=description,
            patient_id=patient_id,
            system_id=system_id,
            status="Active",
            created_at=datetime.now(timezone.utc),
        )

    def create_negative_trend_alert(
        self, patient_id: str, provider_id: str, description: str
    ) -> Alert:
        """Raise the alert that tells a provider a symptom trend is worsening."""

        return Alert(
            alert_id=str(uuid4()),
            alert_type="NegativeTrend",
            description=description,
            patient_id=patient_id,
            provider_id=provider_id,
            status="Active",
            created_at=datetime.now(timezone.utc),
        )

    def record_visit_fields(
        self,
        patient_id: str,
        provider_id: str,
        fields: Mapping[str, Any],
        *,
        visited_at: datetime | None = None,
    ) -> None:
        """Persist the latest documentation fields for one patient-provider pair."""

        pair_key = (patient_id, provider_id)
        event_time = visited_at or datetime.now(timezone.utc)
        latest_time = self._latest_visit_timestamp_by_pair.get(pair_key)

        if latest_time is not None and event_time < latest_time:
            return

        self._previous_visit_fields_by_pair[pair_key] = dict(fields)
        self._latest_visit_timestamp_by_pair[pair_key] = event_time

    def auto_populate_redundant_fields(
        self, patient_id: str, provider_id: str
    ) -> dict[str, object]:
        """Return the data needed to prefill repeated documentation fields."""

        return deepcopy(
            self._previous_visit_fields_by_pair.get((patient_id, provider_id), {})
        )

    def get_last_visit_timestamp(
        self, patient_id: str, provider_id: str
    ) -> datetime | None:
        """Return when the pair-scoped prefill values were most recently updated."""

        return self._latest_visit_timestamp_by_pair.get((patient_id, provider_id))

    def quick_share_progress_report(self, patient_id: str, provider_id: str) -> str:
        """Create the share action used to send a progress report back to the PCP."""

        message = f"Progress report shared with provider {provider_id} for patient {patient_id}."
        self._shared_progress_reports.append(message)
        return message

    def evaluate_negative_trend_threshold(
        self,
        patient_id: str,
        provider_id: str,
        trend_analysis: dict[str, object],
    ) -> Alert | None:
        """Create a negative trend alert if threshold analysis shows concern.

        Args:
            patient_id: Patient identifier
            provider_id: Provider identifier
            trend_analysis: Result from threshold detection methods

        Returns:
            Alert if threshold exceeded, None otherwise
        """
        if not trend_analysis.get("detected"):
            return None

        # Construct description based on threshold type
        if "increase" in trend_analysis:
            # Severity increase threshold
            baseline = trend_analysis.get("baseline_severity", "unknown")
            current = trend_analysis.get("current_severity", "unknown")
            increase = trend_analysis.get("increase", 0)
            threshold = trend_analysis.get("threshold", 0)
            description = (
                f"Negative trend alert: Symptom severity increased by {increase} points "
                f"(from {baseline} to {current}), exceeding threshold of {threshold}."
            )
        elif "consecutive_high_count" in trend_analysis:
            # Consecutive high severity threshold
            consecutive = trend_analysis.get("consecutive_high_count", 0)
            threshold = trend_analysis.get("threshold", 0)
            description = (
                f"Negative trend alert: {consecutive} consecutive high-severity entries recorded, "
                f"exceeding threshold of {threshold}."
            )
        elif "high_severity_percentage" in trend_analysis:
            # High severity percentage threshold
            percentage = float(trend_analysis.get("high_severity_percentage", 0.0))  # type: ignore[arg-type]
            percentage_pct = round(percentage * 100, 1)
            threshold_pct = round(float(trend_analysis.get("threshold", 0.0)) * 100, 1)  # type: ignore[arg-type]
            description = (
                f"Negative trend alert: {percentage_pct}% of symptom entries are high-severity, "
                f"exceeding threshold of {threshold_pct}%."
            )
        else:
            description = "Negative trend detected based on symptom analysis."

        return self.create_negative_trend_alert(
            patient_id=patient_id,
            provider_id=provider_id,
            description=description,
        )

    def should_quick_share_to_pcp(
        self,
        trend_analysis_results: list[dict[str, object]],
    ) -> bool:
        """Determine if any threshold analysis suggests quick-sharing to PCP.

        Returns True if any threshold was exceeded, indicating urgent attention needed.
        """
        return any(result.get("detected", False) for result in trend_analysis_results)
