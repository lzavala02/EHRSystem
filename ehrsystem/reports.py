"""In-memory report job and artifact orchestration.

This module centralizes report queue state and completed metadata so API handlers
can behave like asynchronous workflows while keeping the scaffold lightweight.
"""

from __future__ import annotations

import secrets
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from uuid import uuid4


class InMemoryReportService:
    """Stores queued jobs and generated report metadata in process."""

    def __init__(
        self,
        *,
        jobs_by_report_id: dict[str, dict[str, object]],
        report_metadata_by_id: dict[str, dict[str, str]],
        access_tokens_by_token: dict[str, dict[str, str]],
    ) -> None:
        self._jobs_by_report_id = jobs_by_report_id
        self._report_metadata_by_id = report_metadata_by_id
        self._access_tokens_by_token = access_tokens_by_token

    def queue_trend_report(
        self,
        *,
        patient_id: str,
        generated_by_provider_id: str,
        period_start: datetime,
        period_end: datetime,
        summary: str,
    ) -> dict[str, object]:
        report_id = f"rep-{uuid4()}"
        requested_at = datetime.now(UTC)
        job = {
            "report_id": report_id,
            "patient_id": patient_id,
            "generated_by_provider_id": generated_by_provider_id,
            "period_start": period_start,
            "period_end": period_end,
            "status": "pending",
            "summary": summary,
            "data": {"report_id": report_id},
            "created_at": requested_at.isoformat(),
        }
        self._jobs_by_report_id[report_id] = job
        return deepcopy(job)

    def get_job(self, report_id: str) -> dict[str, object] | None:
        job = self._jobs_by_report_id.get(report_id)
        return deepcopy(job) if job is not None else None

    def complete_job(self, report_id: str) -> dict[str, object]:
        """Marks a queued job complete and creates report metadata."""

        job = self._jobs_by_report_id.get(report_id)
        if job is None:
            raise KeyError(f"Unknown report_id: {report_id}")

        if str(job.get("status")) == "completed":
            return deepcopy(job)

        job["status"] = "processing"

        generated_at = datetime.now(UTC).isoformat()
        self._report_metadata_by_id[report_id] = {
            "report_id": report_id,
            "patient_id": str(job["patient_id"]),
            "generated_by_provider_id": str(job["generated_by_provider_id"]),
            "generated_at": generated_at,
            "secure_url": "",
            "summary": str(job.get("summary") or ""),
        }

        job["status"] = "completed"
        return deepcopy(job)

    def get_report_metadata(self, report_id: str) -> dict[str, str] | None:
        metadata = self._report_metadata_by_id.get(report_id)
        return deepcopy(metadata) if metadata is not None else None

    def issue_secure_access(
        self,
        *,
        report_id: str,
        viewer_user_id: str,
        expires_in_minutes: int = 10,
    ) -> dict[str, str]:
        if report_id not in self._report_metadata_by_id:
            raise KeyError(f"Unknown report_id: {report_id}")

        access_token = secrets.token_urlsafe(24)
        expires_at = datetime.now(UTC) + timedelta(minutes=expires_in_minutes)
        self._access_tokens_by_token[access_token] = {
            "report_id": report_id,
            "viewer_user_id": viewer_user_id,
            "expires_at": expires_at.isoformat(),
        }
        return {
            "access_token": access_token,
            "expires_at": expires_at.isoformat(),
        }

    def validate_secure_access(
        self,
        *,
        report_id: str,
        access_token: str,
        viewer_user_id: str,
    ) -> bool:
        token_record = self._access_tokens_by_token.get(access_token)
        if token_record is None:
            return False
        if token_record.get("report_id") != report_id:
            return False
        if token_record.get("viewer_user_id") != viewer_user_id:
            return False

        expires_at_raw = token_record.get("expires_at")
        if not isinstance(expires_at_raw, str):
            return False
        expires_at = datetime.fromisoformat(expires_at_raw)
        if expires_at <= datetime.now(UTC):
            return False

        return True

    def consume_secure_access(
        self,
        *,
        report_id: str,
        access_token: str,
        viewer_user_id: str,
    ) -> bool:
        """Validate and consume token so secure links are one-time use."""

        is_valid = self.validate_secure_access(
            report_id=report_id,
            access_token=access_token,
            viewer_user_id=viewer_user_id,
        )
        if not is_valid:
            return False

        self._access_tokens_by_token.pop(access_token, None)
        return True

    def list_jobs(self) -> dict[str, dict[str, object]]:
        return deepcopy(self._jobs_by_report_id)

    def list_report_metadata(self) -> dict[str, dict[str, str]]:
        return deepcopy(self._report_metadata_by_id)
