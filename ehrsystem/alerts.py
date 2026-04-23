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
