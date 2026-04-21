"""Cross-system synchronization scaffolding.

The classes in this module cover the Git-like push/pull workflow, protocol
adapters for FHIR and HL7, conflict detection, and the sync timestamp view.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterable
from copy import deepcopy
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import uuid4

from .models import (
    Alert,
    DataCategorySyncStatus,
    MedicalRecordItem,
    SyncConflict,
    SyncMetadataRecord,
)

if TYPE_CHECKING:
    from .alerts import ProviderAlertService


def _default_system_id(system_name: str) -> str:
    """Build a stable system identifier from a human-friendly system name."""

    normalized_name = "".join(
        character.lower() if character.isalnum() else "-" for character in system_name
    )
    squashed = "-".join(part for part in normalized_name.split("-") if part)
    return f"sys-{squashed}" if squashed else "sys-unknown"


class EHRProtocolAdapter(ABC):
    """Abstract contract shared by protocol-specific EHR adapters."""

    def __init__(
        self,
        system_name: str,
        protocol: str,
        system_id: str | None = None,
        records: Iterable[MedicalRecordItem] | None = None,
    ) -> None:
        """Store the adapter identity and its current remote record snapshot."""

        self.system_name = system_name
        self.system_id = system_id or _default_system_id(system_name)
        self.protocol = protocol
        self._records_by_patient: dict[str, list[MedicalRecordItem]] = {}
        self._last_pushed_patient_id: str | None = None

        for record in records or []:
            self._records_by_patient.setdefault(record.patient_id, []).append(
                deepcopy(record)
            )

    @abstractmethod
    def pull_remote_changes(self, patient_id: str) -> list[MedicalRecordItem]:
        """Fetch remote records from the partner EHR system for a patient."""

        return [
            deepcopy(record) for record in self._records_by_patient.get(patient_id, [])
        ]

    @abstractmethod
    def push_local_changes(self, patient_id: str) -> None:
        """Send local clinic updates to the partner EHR system."""

        self._last_pushed_patient_id = patient_id


class FHIRAdapter(EHRProtocolAdapter):
    """FHIR R4 adapter stub for major EHR systems such as Epic and NextGen."""

    def __init__(
        self,
        system_name: str = "FHIR EHR",
        system_id: str | None = None,
        records: Iterable[MedicalRecordItem] | None = None,
    ) -> None:
        """Create a FHIR-specific adapter with the standard protocol label."""

        super().__init__(
            system_name=system_name,
            protocol="FHIR",
            system_id=system_id,
            records=records,
        )

    def pull_remote_changes(self, patient_id: str) -> list[MedicalRecordItem]:
        return super().pull_remote_changes(patient_id)

    def push_local_changes(self, patient_id: str) -> None:
        super().push_local_changes(patient_id)


class HL7Adapter(EHRProtocolAdapter):
    """HL7 adapter stub for EHR systems that expose HL7 integration points."""

    def __init__(
        self,
        system_name: str = "HL7 EHR",
        system_id: str | None = None,
        records: Iterable[MedicalRecordItem] | None = None,
    ) -> None:
        """Create an HL7-specific adapter with the standard protocol label."""

        super().__init__(
            system_name=system_name,
            protocol="HL7",
            system_id=system_id,
            records=records,
        )

    def pull_remote_changes(self, patient_id: str) -> list[MedicalRecordItem]:
        return super().pull_remote_changes(patient_id)

    def push_local_changes(self, patient_id: str) -> None:
        super().push_local_changes(patient_id)


class EpicAdapter(FHIRAdapter):
    """Day 5 base adapter representing Epic push/pull integration."""

    def __init__(self, records: Iterable[MedicalRecordItem] | None = None) -> None:
        super().__init__(system_name="Epic", system_id="sys-epic", records=records)


class NextGenAdapter(HL7Adapter):
    """Day 5 base adapter representing NextGen push/pull integration."""

    def __init__(self, records: Iterable[MedicalRecordItem] | None = None) -> None:
        super().__init__(
            system_name="NextGen",
            system_id="sys-nextgen",
            records=records,
        )


class CrossSystemSyncService:
    """Coordinates patient record synchronization across local and remote EHRs."""

    def __init__(
        self,
        adapters: Iterable[EHRProtocolAdapter] | None = None,
        local_records: Iterable[MedicalRecordItem] | None = None,
    ) -> None:
        """Initialize the local clinic repository and the remote EHR adapters."""

        self.adapters = list(adapters or [])
        self._local_records_by_patient: dict[str, list[MedicalRecordItem]] = {}
        self._last_synced_by_patient_category: dict[tuple[str, str], datetime] = {}
        self._last_system_by_patient_category: dict[tuple[str, str], str] = {}
        self._last_system_id_by_patient_category: dict[tuple[str, str], str] = {}
        self._last_local_snapshot_by_patient_system: dict[
            tuple[str, str], list[MedicalRecordItem]
        ] = {}
        self._last_remote_snapshot_by_patient_system: dict[
            tuple[str, str], list[MedicalRecordItem]
        ] = {}

        for record in local_records or []:
            self._local_records_by_patient.setdefault(record.patient_id, []).append(
                deepcopy(record)
            )

    @staticmethod
    def _utc_now() -> datetime:
        """Return a timezone-aware UTC timestamp for all sync bookkeeping."""

        return datetime.now(timezone.utc)

    def _upsert_local_record(self, record: MedicalRecordItem) -> None:
        """Keep the local repository aligned to the latest pulled snapshot."""

        patient_records = self._local_records_by_patient.setdefault(
            record.patient_id, []
        )
        for index, existing_record in enumerate(patient_records):
            if existing_record.record_id == record.record_id:
                patient_records[index] = deepcopy(record)
                break
        else:
            patient_records.append(deepcopy(record))

    def _latest_record_by_category(
        self, records: Iterable[MedicalRecordItem]
    ) -> dict[str, MedicalRecordItem]:
        """Return the newest record per category so sync decisions stay simple."""

        latest_records: dict[str, MedicalRecordItem] = {}
        for record in records:
            current = latest_records.get(record.category)
            if current is None or record.recorded_at >= current.recorded_at:
                latest_records[record.category] = record
        return latest_records

    def pull_remote_changes(self, patient_id: str) -> list[MedicalRecordItem]:
        """Pull remote changes into the clinic's local repository."""

        pulled_records: list[MedicalRecordItem] = []

        for adapter in self.adapters:
            self._last_local_snapshot_by_patient_system[
                (patient_id, adapter.system_name)
            ] = [
                deepcopy(record)
                for record in self._local_records_by_patient.get(patient_id, [])
            ]
            remote_records = adapter.pull_remote_changes(patient_id)
            self._last_remote_snapshot_by_patient_system[
                (patient_id, adapter.system_name)
            ] = [deepcopy(record) for record in remote_records]
            for record in remote_records:
                pulled_records.append(deepcopy(record))
                self._upsert_local_record(record)
                sync_key = (patient_id, record.category)
                self._last_synced_by_patient_category[sync_key] = self._utc_now()
                self._last_system_by_patient_category[sync_key] = adapter.system_name
                self._last_system_id_by_patient_category[sync_key] = adapter.system_id

        return pulled_records

    def push_local_changes(self, patient_id: str) -> None:
        """Push local clinic changes out to the remote EHR repository."""

        local_records = [
            deepcopy(record)
            for record in self._local_records_by_patient.get(patient_id, [])
        ]

        for adapter in self.adapters:
            adapter._records_by_patient[patient_id] = [
                deepcopy(record) for record in local_records
            ]
            adapter.push_local_changes(patient_id)

            for record in local_records:
                sync_key = (patient_id, record.category)
                self._last_synced_by_patient_category[sync_key] = self._utc_now()
                self._last_system_by_patient_category[sync_key] = adapter.system_name
                self._last_system_id_by_patient_category[sync_key] = adapter.system_id

    def get_sync_metadata_records(self, patient_id: str) -> list[SyncMetadataRecord]:
        """Build sync metadata rows that mirror the persistence-layer shape."""

        metadata_rows: list[SyncMetadataRecord] = []
        for (sync_patient_id, category), last_synced_at in sorted(
            self._last_synced_by_patient_category.items()
        ):
            if sync_patient_id != patient_id:
                continue
            metadata_rows.append(
                SyncMetadataRecord(
                    patient_id=patient_id,
                    system_id=self._last_system_id_by_patient_category.get(
                        (patient_id, category), "sys-clinic-repository"
                    ),
                    category=category,
                    sync_direction="bidirectional",
                    last_synced_at=last_synced_at,
                    created_at=last_synced_at,
                    updated_at=last_synced_at,
                )
            )

        return metadata_rows

    def get_last_synced_status(self, patient_id: str) -> list[DataCategorySyncStatus]:
        """Return the per-category timestamps used by the dashboard and sync UI."""

        categories = {
            record.category
            for record in self._local_records_by_patient.get(patient_id, [])
        }
        categories.update(
            category
            for patient, category in self._last_synced_by_patient_category
            if patient == patient_id
        )

        status_rows: list[DataCategorySyncStatus] = []
        for category in sorted(categories):
            sync_key = (patient_id, category)
            status_rows.append(
                DataCategorySyncStatus(
                    category=category,
                    last_synced_at=self._last_synced_by_patient_category.get(sync_key),
                    system_name=self._last_system_by_patient_category.get(
                        sync_key, "Clinic Repository"
                    ),
                )
            )

        return status_rows

    def detect_conflicts(self, patient_id: str) -> list[SyncConflict]:
        """Compare local and remote records to find data conflicts."""

        local_latest = self._latest_record_by_category(
            self._local_records_by_patient.get(patient_id, [])
        )
        conflicts: list[SyncConflict] = []

        for adapter in self.adapters:
            local_snapshot = self._last_local_snapshot_by_patient_system.get(
                (patient_id, adapter.system_name)
            )
            local_records = (
                local_snapshot
                if local_snapshot is not None
                else self._local_records_by_patient.get(patient_id, [])
            )
            remote_snapshot = self._last_remote_snapshot_by_patient_system.get(
                (patient_id, adapter.system_name)
            )
            remote_records = (
                remote_snapshot
                if remote_snapshot is not None
                else adapter.pull_remote_changes(patient_id)
            )
            remote_latest = self._latest_record_by_category(remote_records)
            local_latest = self._latest_record_by_category(local_records)
            for category, remote_record in remote_latest.items():
                local_record = local_latest.get(category)
                if local_record is None:
                    continue
                if local_record.value_description != remote_record.value_description:
                    conflicts.append(
                        SyncConflict(
                            patient_id=patient_id,
                            category=category,
                            local_value=local_record.value_description,
                            remote_value=remote_record.value_description,
                            system_name=adapter.system_name,
                            detected_at=self._utc_now(),
                        )
                    )

        return conflicts

    def report_conflict(self, conflict: SyncConflict) -> Alert:
        """Create the alert object that notifies providers about a sync conflict."""

        system_id = _default_system_id(conflict.system_name)

        return Alert(
            alert_id=str(uuid4()),
            alert_type="Data Conflict",
            description=(
                f"{conflict.system_name} reported a conflict for {conflict.category}: "
                f"local='{conflict.local_value}' remote='{conflict.remote_value}'."
            ),
            patient_id=conflict.patient_id,
            system_id=system_id,
            status="Active",
            created_at=self._utc_now(),
        )

    def sync_patient_bidirectional(
        self,
        patient_id: str,
        alert_service: ProviderAlertService | None = None,
    ) -> tuple[list[MedicalRecordItem], list[SyncConflict], list[Alert]]:
        """Execute pull-then-push sync and raise provider alerts for conflicts."""

        pulled_records = self.pull_remote_changes(patient_id)
        conflicts = self.detect_conflicts(patient_id)

        provider_alerts: list[Alert] = []
        for conflict in conflicts:
            if alert_service is not None:
                conflict_alert = alert_service.create_data_conflict_alert(
                    patient_id=conflict.patient_id,
                    system_id=_default_system_id(conflict.system_name),
                    description=(
                        f"{conflict.system_name} conflict in {conflict.category}: "
                        f"local='{conflict.local_value}' remote='{conflict.remote_value}'."
                    ),
                )
            else:
                conflict_alert = self.report_conflict(conflict)
            provider_alerts.append(conflict_alert)

        self.push_local_changes(patient_id)
        return pulled_records, conflicts, provider_alerts
