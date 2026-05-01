"""In-memory report job and artifact orchestration.

This module centralizes report queue state and completed metadata so API handlers
can behave like asynchronous workflows while keeping the scaffold lightweight.
"""

from __future__ import annotations

import secrets
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from typing import cast
from uuid import uuid4

from .models import SymptomTrendReport


def _escape_pdf_text(value: str) -> str:
    sanitized = value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    return "".join(
        character if 32 <= ord(character) <= 126 else "?" for character in sanitized
    )


def _build_pdf_document(lines: list[str]) -> bytes:
    pdf_lines = lines[:36] or ["Trend report unavailable."]
    commands = ["BT", "/F1 11 Tf", "50 760 Td"]

    for index, line in enumerate(pdf_lines):
        escaped = _escape_pdf_text(line[:110])
        if index == 0:
            commands.append(f"({escaped}) Tj")
            continue
        commands.append(f"0 -16 Td ({escaped}) Tj")

    commands.append("ET")
    stream = "\n".join(commands).encode("latin-1", errors="replace")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>"
        ),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length "
        + str(len(stream)).encode("ascii")
        + b" >>\nstream\n"
        + stream
        + b"\nendstream",
    ]

    document = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = []

    for index, obj in enumerate(objects, start=1):
        offsets.append(len(document))
        document.extend(f"{index} 0 obj\n".encode("ascii"))
        document.extend(obj)
        document.extend(b"\nendobj\n")

    xref_offset = len(document)
    document.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    document.extend(b"0000000000 65535 f \n")
    for offset in offsets:
        document.extend(f"{offset:010} 00000 n \n".encode("ascii"))

    document.extend(
        (
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF"
        ).encode("ascii")
    )
    return bytes(document)


class InMemoryReportService:
    """Stores queued jobs and generated report metadata in process."""

    def __init__(
        self,
        *,
        jobs_by_report_id: dict[str, dict[str, object]],
        report_metadata_by_id: dict[str, dict[str, object]],
        access_tokens_by_token: dict[str, dict[str, str]],
    ) -> None:
        self._jobs_by_report_id = jobs_by_report_id
        self._report_metadata_by_id = report_metadata_by_id
        self._access_tokens_by_token = access_tokens_by_token

    def queue_trend_report(
        self,
        *,
        generated_by_provider_id: str,
        report: SymptomTrendReport,
    ) -> dict[str, object]:
        report_id = f"rep-{uuid4()}"
        requested_at = datetime.now(UTC)
        job = {
            "report_id": report_id,
            "patient_id": report.patient_id,
            "generated_by_provider_id": generated_by_provider_id,
            "period_start": report.period_start,
            "period_end": report.period_end,
            "status": "pending",
            "summary": report.summary,
            "report_payload": {
                "patient_id": report.patient_id,
                "period_start": report.period_start.isoformat(),
                "period_end": report.period_end.isoformat(),
                "summary": report.summary,
                "symptoms": [
                    {
                        "logged_at": (
                            symptom.log_date or report.period_start
                        ).isoformat(),
                        "description": symptom.symptom_description,
                        "severity_scale": symptom.severity_scale,
                    }
                    for symptom in report.symptoms
                ],
                "triggers": [trigger.trigger_name for trigger in report.triggers],
                "treatments": [
                    treatment.product_name for treatment in report.treatments
                ],
            },
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
        report_payload = deepcopy(
            cast(dict[str, object], job.get("report_payload") or {})
        )
        self._report_metadata_by_id[report_id] = {
            "report_id": report_id,
            "patient_id": str(job["patient_id"]),
            "generated_by_provider_id": str(job["generated_by_provider_id"]),
            "generated_at": generated_at,
            "secure_url": "",
            "summary": str(job.get("summary") or ""),
            "period_start": report_payload.get("period_start")
            or str(job["period_start"]),
            "period_end": report_payload.get("period_end") or str(job["period_end"]),
            "symptom_count": len(
                cast(list[object], report_payload.get("symptoms") or [])
            ),
            "trigger_names": cast(list[object], report_payload.get("triggers") or []),
            "treatment_names": cast(
                list[object], report_payload.get("treatments") or []
            ),
            "symptoms": cast(list[object], report_payload.get("symptoms") or []),
        }

        job["status"] = "completed"
        return deepcopy(job)

    def get_report_metadata(self, report_id: str) -> dict[str, object] | None:
        metadata = self._report_metadata_by_id.get(report_id)
        return deepcopy(metadata) if metadata is not None else None

    def render_report_pdf(self, report_id: str) -> bytes:
        metadata = self._report_metadata_by_id.get(report_id)
        if metadata is None:
            raise KeyError(f"Unknown report_id: {report_id}")

        symptom_entries = cast(list[object], metadata.get("symptoms") or [])
        symptom_lines = []
        for symptom in symptom_entries[:10]:
            if not isinstance(symptom, dict):
                continue
            logged_at = str(symptom.get("logged_at") or "unknown time")
            severity_scale = symptom.get("severity_scale")
            severity_label = (
                f"severity {severity_scale}"
                if severity_scale is not None
                else "severity n/a"
            )
            description = str(symptom.get("description") or "No description recorded")
            symptom_lines.append(f"- {logged_at}: {severity_label}; {description}")

        lines = [
            "Symptom Trend Report",
            f"Report ID: {report_id}",
            f"Patient ID: {metadata.get('patient_id', '')}",
            f"Generated By: {metadata.get('generated_by_provider_id', '')}",
            f"Generated At: {metadata.get('generated_at', '')}",
            f"Reporting Period: {metadata.get('period_start', '')} to {metadata.get('period_end', '')}",
            "",
            f"Summary: {metadata.get('summary', '')}",
            "",
            f"Symptoms Logged: {metadata.get('symptom_count', 0)}",
            f"Triggers Observed: {', '.join(str(name) for name in cast(list[object], metadata.get('trigger_names') or [])) or 'None recorded'}",
            f"Treatments Used: {', '.join(str(name) for name in cast(list[object], metadata.get('treatment_names') or [])) or 'None recorded'}",
            "",
            "Symptom Timeline:",
            *symptom_lines,
        ]
        return _build_pdf_document(lines)

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

    def list_report_metadata(self) -> dict[str, dict[str, object]]:
        return deepcopy(self._report_metadata_by_id)
