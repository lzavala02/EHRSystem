"""Unified chronic disease dashboard scaffolding.

This module exposes the smallest set of service methods needed to aggregate
multi-source history, list care team members, and highlight missing data.
"""

from __future__ import annotations

from collections.abc import Iterable
from copy import deepcopy

from .models import (
    CareTeamMember,
    DashboardSnapshot,
    MedicalRecordItem,
    MissingDataField,
    Patient,
    Provider,
)


class UnifiedChronicDiseaseDashboardService:
    """Builds the single patient view used by the chronic disease dashboard."""

    def __init__(
        self,
        patients: Iterable[Patient] | None = None,
        providers: Iterable[Provider] | None = None,
        medical_records: Iterable[MedicalRecordItem] | None = None,
        care_team_by_patient: dict[str, Iterable[str]] | None = None,
    ) -> None:
        """Store the patient registry, provider registry, and history snapshot."""

        self._patients_by_id = {
            patient.patient_id: deepcopy(patient) for patient in patients or []
        }
        self._providers_by_id = {
            provider.provider_id: deepcopy(provider) for provider in providers or []
        }
        self._medical_records_by_patient: dict[str, list[MedicalRecordItem]] = {}
        self._care_team_by_patient = {
            patient_id: list(provider_ids)
            for patient_id, provider_ids in (care_team_by_patient or {}).items()
        }

        for record in medical_records or []:
            self._medical_records_by_patient.setdefault(record.patient_id, []).append(
                deepcopy(record)
            )

    def _build_care_team_member(self, provider_id: str) -> CareTeamMember | None:
        """Translate a provider record into the dashboard-friendly view model."""

        provider = self._providers_by_id.get(provider_id)
        if provider is None:
            return None

        return CareTeamMember(
            provider_id=provider.provider_id,
            provider_name=provider.name,
            specialty=provider.specialty,
            clinic_affiliation=provider.clinic_affiliation,
        )

    def build_dashboard(self, patient_id: str) -> DashboardSnapshot:
        """Assemble the dashboard payload from multiple EHR and clinic sources."""

        return DashboardSnapshot(
            patient_id=patient_id,
            providers=self.list_care_team(patient_id),
            medical_history=sorted(
                [
                    deepcopy(record)
                    for record in self._medical_records_by_patient.get(patient_id, [])
                ],
                key=lambda record: record.recorded_at,
                reverse=True,
            ),
            missing_data=self.identify_missing_data(patient_id),
        )

    def list_care_team(self, patient_id: str) -> list[CareTeamMember]:
        """Return the consolidated list of providers involved in the patient's care."""

        patient = self._patients_by_id.get(patient_id)
        if patient is None:
            raise KeyError(f"Unknown patient_id: {patient_id}")

        care_team_ids = []
        if patient.primary_provider_id:
            care_team_ids.append(patient.primary_provider_id)
        care_team_ids.extend(self._care_team_by_patient.get(patient_id, []))

        members: list[CareTeamMember] = []
        seen_provider_ids: set[str] = set()
        for provider_id in care_team_ids:
            if provider_id in seen_provider_ids:
                continue
            member = self._build_care_team_member(provider_id)
            if member is None:
                continue
            seen_provider_ids.add(provider_id)
            members.append(member)

        return members

    def identify_missing_data(self, patient_id: str) -> list[MissingDataField]:
        """Return the fields that should be highlighted as incomplete."""

        patient = self._patients_by_id.get(patient_id)
        if patient is None:
            raise KeyError(f"Unknown patient_id: {patient_id}")

        missing_fields: list[MissingDataField] = []
        checks = [
            ("Height", patient.height),
            ("Weight", patient.weight),
            ("Vaccination Record", patient.vaccination_record),
            ("Family History", patient.family_history),
        ]

        for field_name, value in checks:
            if value in (None, ""):
                missing_fields.append(
                    MissingDataField(
                        field_name=field_name,
                        reason=f"{field_name} is missing and should be confirmed with the patient.",
                    )
                )

        return missing_fields
