"""Symptom, trigger, and treatment logging scaffolding.

This module covers the psoriasis-focused logging flow and the trend report that
providers can review or share later.
"""

from __future__ import annotations

from collections.abc import Iterable
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import uuid4

from .models import SymptomLog, SymptomTrendReport, Treatment, Trigger


@dataclass(slots=True)
class PsoriasisPayload:
    """Normalized psoriasis payload used for API-level symptom validation."""

    symptom_description: str
    severity_scale: int
    trigger_names: list[str]
    otc_treatments: list[str]


class SymptomValidationError(ValueError):
    """Validation error raised when a symptom payload violates business rules."""


class SymptomLoggingService:
    """Stores patient symptom notes, triggers, and OTC treatment references."""

    def __init__(
        self,
        symptom_logs: Iterable[SymptomLog] | None = None,
        triggers: Iterable[Trigger] | None = None,
        treatments: Iterable[Treatment] | None = None,
    ) -> None:
        """Create the in-memory store used by the logging workflow."""

        self._symptom_logs_by_id: dict[str, SymptomLog] = {}
        self._symptom_logs_by_patient: dict[str, list[SymptomLog]] = {}
        self._triggers_by_log_id: dict[str, list[Trigger]] = {}
        self._treatments_by_log_id: dict[str, list[Treatment]] = {}
        self._trigger_catalog = {
            trigger.trigger_id: deepcopy(trigger) for trigger in triggers or []
        }
        self._treatment_catalog = {
            treatment.treatment_id: deepcopy(treatment)
            for treatment in treatments or []
        }

        for log in symptom_logs or []:
            self._symptom_logs_by_id[log.log_id] = deepcopy(log)
            self._symptom_logs_by_patient.setdefault(log.patient_id, []).append(
                deepcopy(log)
            )

    def _ensure_log_exists(self, symptom_log_id: str) -> SymptomLog:
        """Return the referenced log or raise a clear error for invalid IDs."""

        symptom_log = self._symptom_logs_by_id.get(symptom_log_id)
        if symptom_log is None:
            raise KeyError(f"Unknown symptom_log_id: {symptom_log_id}")
        return symptom_log

    def _is_psoriasis_oriented_description(self, symptom_description: str) -> bool:
        """Return whether symptom text includes psoriasis-oriented vocabulary."""

        normalized = symptom_description.casefold()
        psoriasis_terms = (
            "psoriasis",
            "plaque",
            "scale",
            "scalp",
            "redness",
            "itch",
            "flare",
            "lesion",
            "joint",
            "skin",
        )
        return any(term in normalized for term in psoriasis_terms)

    def validate_psoriasis_payload(self, payload: PsoriasisPayload) -> None:
        """Enforce psoriasis-specific symptom and severity business constraints."""

        description = payload.symptom_description.strip()
        if len(description) < 10:
            raise SymptomValidationError(
                "symptom_description must be at least 10 characters"
            )
        if not self._is_psoriasis_oriented_description(description):
            raise SymptomValidationError(
                "symptom_description must reference psoriasis-oriented symptoms"
            )

        if not 1 <= payload.severity_scale <= 10:
            raise SymptomValidationError("severity_scale must be between 1 and 10")

        trigger_names = [name.strip() for name in payload.trigger_names if name.strip()]
        if not trigger_names:
            raise SymptomValidationError("At least one trigger is required")

        otc_treatments = [
            treatment.strip()
            for treatment in payload.otc_treatments
            if treatment.strip()
        ]
        if payload.severity_scale >= 8 and not otc_treatments:
            raise SymptomValidationError(
                "At least one OTC treatment is required when severity is 8 or higher"
            )

    def get_severity_level(self, severity_scale: int | None) -> str | None:
        """Map the numeric severity scale to a business-readable severity level."""

        if severity_scale is None:
            return None
        if severity_scale <= 3:
            return "mild"
        if severity_scale <= 7:
            return "moderate"
        return "severe"

    def log_symptom(
        self,
        patient_id: str,
        symptom_description: str,
        severity_scale: int | None = None,
    ) -> SymptomLog:
        """Create the base symptom entry before triggers and treatments are attached."""

        if severity_scale is not None and not 1 <= severity_scale <= 10:
            raise ValueError("severity_scale must be between 1 and 10 when provided")

        symptom_log = SymptomLog(
            log_id=str(uuid4()),
            patient_id=patient_id,
            symptom_description=symptom_description,
            severity_scale=severity_scale,
            log_date=datetime.now(timezone.utc),
        )
        self._symptom_logs_by_id[symptom_log.log_id] = symptom_log
        self._symptom_logs_by_patient.setdefault(patient_id, []).append(symptom_log)
        return deepcopy(symptom_log)

    def attach_triggers(self, symptom_log_id: str, triggers: list[Trigger]) -> None:
        """Associate one symptom entry with the trigger checklist selections."""

        self._ensure_log_exists(symptom_log_id)
        self._triggers_by_log_id[symptom_log_id] = [
            deepcopy(trigger) for trigger in triggers
        ]
        for trigger in triggers:
            self._trigger_catalog[trigger.trigger_id] = deepcopy(trigger)

    def attach_treatments(
        self, symptom_log_id: str, treatments: list[Treatment]
    ) -> None:
        """Associate one symptom entry with logged OTC products or supplements."""

        self._ensure_log_exists(symptom_log_id)
        self._treatments_by_log_id[symptom_log_id] = [
            deepcopy(treatment) for treatment in treatments
        ]
        for treatment in treatments:
            self._treatment_catalog[treatment.treatment_id] = deepcopy(treatment)

    def generate_trend_report(
        self,
        patient_id: str,
        period_start: datetime,
        period_end: datetime,
    ) -> SymptomTrendReport:
        """Produce the shareable trend report used during provider follow-up."""

        logs_in_range = [
            deepcopy(log)
            for log in self._symptom_logs_by_patient.get(patient_id, [])
            if period_start <= (log.log_date or period_start) <= period_end
        ]
        logs_in_range.sort(key=lambda log: log.log_date or period_start)

        trigger_items: list[Trigger] = []
        treatment_items: list[Treatment] = []
        seen_trigger_ids: set[str] = set()
        seen_treatment_ids: set[str] = set()

        for log in logs_in_range:
            for trigger in self._triggers_by_log_id.get(log.log_id, []):
                if trigger.trigger_id in seen_trigger_ids:
                    continue
                seen_trigger_ids.add(trigger.trigger_id)
                trigger_items.append(deepcopy(trigger))

            for treatment in self._treatments_by_log_id.get(log.log_id, []):
                if treatment.treatment_id in seen_treatment_ids:
                    continue
                seen_treatment_ids.add(treatment.treatment_id)
                treatment_items.append(deepcopy(treatment))

        severity_values = [
            log.severity_scale
            for log in logs_in_range
            if log.severity_scale is not None
        ]
        if not logs_in_range:
            summary = "No symptom logs were recorded for the selected period."
        elif len(severity_values) < 2:
            summary = f"Trend report generated from {len(logs_in_range)} symptom log(s), but severity trend is not yet measurable."
        elif severity_values[-1] > severity_values[0]:
            summary = "Negative trend detected: the latest symptom severity is worse than the earlier baseline."
        elif severity_values[-1] < severity_values[0]:
            summary = "Positive trend detected: the latest symptom severity is better than the earlier baseline."
        else:
            summary = "Symptom severity is stable across the selected period."

        return SymptomTrendReport(
            patient_id=patient_id,
            period_start=period_start,
            period_end=period_end,
            summary=summary,
            symptoms=logs_in_range,
            triggers=trigger_items,
            treatments=treatment_items,
        )
