"""Cross-system synchronization scaffolding.

The classes in this module cover the Git-like push/pull workflow, protocol
adapters for FHIR and HL7, conflict detection, and the sync timestamp view.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterable
from copy import deepcopy
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Literal, cast
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
        self._last_outbound_payload: dict[str, object] | str | None = None

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

    def _build_fhir_r4_bundle(
        self, patient_id: str, records: Iterable[MedicalRecordItem]
    ) -> dict[str, object]:
        entries = [
            {
                "resource": {
                    "resourceType": "Observation",
                    "id": record.record_id,
                    "subject": {"reference": f"Patient/{patient_id}"},
                    "category": [{"text": record.category}],
                    "valueString": record.value_description,
                    "effectiveDateTime": record.recorded_at.isoformat(),
                }
            }
            for record in records
        ]
        return {
            "resourceType": "Bundle",
            "type": "collection",
            "entry": entries,
        }

    def _parse_fhir_r4_bundle(
        self, patient_id: str, bundle: dict[str, object]
    ) -> list[MedicalRecordItem]:
        parsed_records: list[MedicalRecordItem] = []
        entries = cast(list[dict[str, object]], bundle.get("entry", []))
        for entry in entries:
            resource = cast(dict[str, object], entry.get("resource", {}))
            category_items = cast(
                list[dict[str, object]], resource.get("category", [{"text": "Unknown"}])
            )
            category_text = category_items[0].get("text", "Unknown")
            effective = resource.get("effectiveDateTime")
            parsed_records.append(
                MedicalRecordItem(
                    record_id=str(resource.get("id", f"epic-{uuid4()}")),
                    patient_id=patient_id,
                    system_id=self.system_id,
                    category=str(category_text),
                    value_description=str(resource.get("valueString", "")),
                    recorded_at=datetime.fromisoformat(str(effective)),
                )
            )
        return parsed_records

    def pull_remote_changes(self, patient_id: str) -> list[MedicalRecordItem]:
        raw_records = super().pull_remote_changes(patient_id)
        bundle = self._build_fhir_r4_bundle(patient_id, raw_records)
        return self._parse_fhir_r4_bundle(patient_id, bundle)

    def push_local_changes(self, patient_id: str) -> None:
        payload = self._build_fhir_r4_bundle(
            patient_id, self._records_by_patient.get(patient_id, [])
        )
        self._last_outbound_payload = payload
        super().push_local_changes(patient_id)


class NextGenAdapter(HL7Adapter):
    """Day 5 base adapter representing NextGen push/pull integration."""

    def __init__(self, records: Iterable[MedicalRecordItem] | None = None) -> None:
        super().__init__(
            system_name="NextGen",
            system_id="sys-nextgen",
            records=records,
        )

    def _build_hl7_message(
        self, patient_id: str, records: Iterable[MedicalRecordItem]
    ) -> str:
        segments = [
            f"MSH|^~\\&|CLINIC|EHR|NEXTGEN|EHR|{self._utc_timestamp()}||ORU^R01"
        ]
        segments.append(f"PID|||{patient_id}")
        for record in records:
            segments.append(
                "OBX|||"
                f"{record.category}|{record.value_description}|{record.recorded_at.isoformat()}|{record.record_id}"
            )
        return "\n".join(segments)

    @staticmethod
    def _utc_timestamp() -> str:
        return datetime.now(timezone.utc).strftime("%Y%m%d%H%M%SZ")

    def _parse_hl7_message(
        self, patient_id: str, message: str
    ) -> list[MedicalRecordItem]:
        records: list[MedicalRecordItem] = []
        for line in message.splitlines():
            if not line.startswith("OBX|"):
                continue
            fields = line.split("|")
            if len(fields) < 7:
                continue
            records.append(
                MedicalRecordItem(
                    record_id=fields[6] or f"nextgen-{uuid4()}",
                    patient_id=patient_id,
                    system_id=self.system_id,
                    category=fields[3],
                    value_description=fields[4],
                    recorded_at=datetime.fromisoformat(fields[5]),
                )
            )
        return records

    def pull_remote_changes(self, patient_id: str) -> list[MedicalRecordItem]:
        raw_records = super().pull_remote_changes(patient_id)
        message = self._build_hl7_message(patient_id, raw_records)
        return self._parse_hl7_message(patient_id, message)

    def push_local_changes(self, patient_id: str) -> None:
        message = self._build_hl7_message(
            patient_id, self._records_by_patient.get(patient_id, [])
        )
        self._last_outbound_payload = message
        super().push_local_changes(patient_id)


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
        self._open_conflicts_by_patient: dict[str, list[SyncConflict]] = {}

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
            alert_type="SyncConflict",
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
                        f"local='{conflict.local_value}' remote='{conflict.remote_value}'. "
                        "Manual resolution required."
                    ),
                )
            else:
                conflict_alert = self.report_conflict(conflict)
            provider_alerts.append(conflict_alert)

        self._open_conflicts_by_patient[patient_id] = [
            deepcopy(conflict) for conflict in conflicts
        ]

        self.push_local_changes(patient_id)
        return pulled_records, conflicts, provider_alerts

    def get_open_conflicts(self, patient_id: str) -> list[SyncConflict]:
        """Return unresolved sync conflicts for manual provider resolution."""

        return [
            deepcopy(conflict)
            for conflict in self._open_conflicts_by_patient.get(patient_id, [])
        ]

    def resolve_conflict(
        self,
        patient_id: str,
        category: str,
        system_name: str,
        resolution: Literal["accept_local", "accept_remote"],
    ) -> SyncConflict | None:
        """Resolve a conflict manually by choosing local or remote source of truth."""

        unresolved_conflicts = self._open_conflicts_by_patient.get(patient_id, [])
        matching_conflict: SyncConflict | None = None
        remaining_conflicts: list[SyncConflict] = []
        for conflict in unresolved_conflicts:
            if (
                matching_conflict is None
                and conflict.category == category
                and conflict.system_name == system_name
            ):
                matching_conflict = deepcopy(conflict)
                continue
            remaining_conflicts.append(conflict)

        if matching_conflict is None:
            return None

        if resolution == "accept_remote":
            for adapter in self.adapters:
                if adapter.system_name != system_name:
                    continue
                for remote_record in adapter.pull_remote_changes(patient_id):
                    if remote_record.category == category:
                        self._upsert_local_record(remote_record)
                        break
                break
        else:
            self.push_local_changes(patient_id)

        self._open_conflicts_by_patient[patient_id] = remaining_conflicts
        return matching_conflict
