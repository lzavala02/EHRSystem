"""Provider alerting and documentation-assist scaffolding.

This module keeps the proactive alert and quick-share concerns separate from the
rest of the stories so each workflow stays easy to reason about.
"""

from __future__ import annotations

from collections.abc import Mapping
from copy import deepcopy
from datetime import datetime, timezone
from uuid import uuid4

from .models import Alert


class ProviderAlertService:
    """Creates alerts for negative trends, conflicts, and documentation support."""

    def __init__(
        self,
        previous_visit_fields_by_patient: Mapping[str, dict[str, object]] | None = None,
    ) -> None:
        """Store the last known visit values used for auto-population."""

        self._previous_visit_fields_by_patient = {
            patient_id: deepcopy(fields)
            for patient_id, fields in (previous_visit_fields_by_patient or {}).items()
        }
        self._shared_progress_reports: list[str] = []

    def create_data_conflict_alert(
        self, patient_id: str, system_id: str, description: str
    ) -> Alert:
        """Raise the alert that tells a provider sync found a conflict."""

        return Alert(
            alert_id=str(uuid4()),
            alert_type="Data Conflict",
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
            alert_type="Negative Trend",
            description=description,
            patient_id=patient_id,
            provider_id=provider_id,
            status="Active",
            created_at=datetime.now(timezone.utc),
        )

    def auto_populate_redundant_fields(self, patient_id: str) -> dict[str, object]:
        """Return the data needed to prefill repeated documentation fields."""

        return deepcopy(self._previous_visit_fields_by_patient.get(patient_id, {}))

    def quick_share_progress_report(self, patient_id: str, provider_id: str) -> str:
        """Create the share action used to send a progress report back to the PCP."""

        message = f"Progress report shared with provider {provider_id} for patient {patient_id}."
        self._shared_progress_reports.append(message)
        return message
