"""Secure digital consent workflow scaffolding.

The methods here model the approval flow, immediate patient notification, HIPAA
authorization generation, and mandatory two-factor checks.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from copy import deepcopy
from datetime import datetime, timezone
from uuid import uuid4

from .models import AccessRequest


class ConsentWorkflowService:
    """Handles provider access requests and the patient's consent response."""

    def __init__(
        self,
        access_requests: Iterable[AccessRequest] | None = None,
        two_factor_enabled_by_user: dict[str, bool] | None = None,
        audit_recorder: (
            Callable[[str, str | None, str | None, dict[str, str]], None] | None
        ) = None,
        notification_sender: Callable[[AccessRequest], None] | None = None,
        document_generator: Callable[[AccessRequest], str] | None = None,
    ) -> None:
        """Store access requests and the login security flags used by the workflow."""

        self._access_requests_by_id: dict[str, AccessRequest] = {
            request.request_id: deepcopy(request) for request in access_requests or []
        }
        self._notifications_by_request_id: dict[str, str] = {}
        self._two_factor_enabled_by_user = dict(two_factor_enabled_by_user or {})
        self._audit_recorder = audit_recorder
        self._notification_sender = notification_sender
        self._document_generator = (
            document_generator or self._default_document_generator
        )

    def _record_audit(
        self,
        event_type: str,
        *,
        actor_id: str | None,
        target_id: str | None,
        metadata: dict[str, str],
    ) -> None:
        if self._audit_recorder is None:
            return
        self._audit_recorder(event_type, actor_id, target_id, metadata)

    @staticmethod
    def _default_document_generator(access_request: AccessRequest) -> str:
        return (
            "HIPAA Digital Authorization Document\n"
            f"Request ID: {access_request.request_id}\n"
            f"Patient ID: {access_request.patient_id}\n"
            f"Provider ID: {access_request.provider_id}\n"
            f"Approved At: {access_request.responded_at.isoformat() if access_request.responded_at else 'Pending'}\n"
            "This document records patient-approved access to protected health information."
        )

    def _get_request(self, access_request_id: str) -> AccessRequest:
        """Return a request by ID or raise a clear error when the ID is invalid."""

        access_request = self._access_requests_by_id.get(access_request_id)
        if access_request is None:
            raise KeyError(f"Unknown access_request_id: {access_request_id}")
        return access_request

    def create_access_request(self, patient_id: str, provider_id: str) -> AccessRequest:
        """Open a new pending consent request for the patient."""

        access_request = AccessRequest(
            request_id=str(uuid4()),
            patient_id=patient_id,
            provider_id=provider_id,
            status="Pending",
            requested_at=datetime.now(timezone.utc),
        )
        self._access_requests_by_id[access_request.request_id] = access_request
        self._record_audit(
            "consent.request.created",
            actor_id=provider_id,
            target_id=access_request.request_id,
            metadata={
                "patient_id": patient_id,
                "provider_id": provider_id,
                "status": access_request.status,
            },
        )
        return deepcopy(access_request)

    def notify_patient(self, access_request_id: str) -> None:
        """Send the immediate in-app, email, or SMS notification to the patient."""

        access_request = self._get_request(access_request_id)
        self._notifications_by_request_id[access_request_id] = (
            f"Notification sent for access request {access_request.request_id} to patient {access_request.patient_id}."
        )
        if self._notification_sender is not None:
            self._notification_sender(deepcopy(access_request))
        self._record_audit(
            "consent.request.notified",
            actor_id=access_request.provider_id,
            target_id=access_request.request_id,
            metadata={
                "patient_id": access_request.patient_id,
                "provider_id": access_request.provider_id,
                "channel": "in_app",
            },
        )

    def respond_to_request(
        self, access_request_id: str, decision: str
    ) -> AccessRequest:
        """Record the patient's approval or denial response."""

        access_request = self._get_request(access_request_id)
        normalized_decision = decision.strip().lower()

        if normalized_decision == "approve":
            access_request.status = "Approved"
        elif normalized_decision == "deny":
            access_request.status = "Denied"
        else:
            raise ValueError("decision must be either 'Approve' or 'Deny'")

        access_request.responded_at = datetime.now(timezone.utc)
        self._record_audit(
            "consent.decision.recorded",
            actor_id=access_request.patient_id,
            target_id=access_request.request_id,
            metadata={
                "patient_id": access_request.patient_id,
                "provider_id": access_request.provider_id,
                "status": access_request.status,
            },
        )
        return deepcopy(access_request)

    def generate_digital_authorization_document(self, access_request_id: str) -> str:
        """Create the HIPAA-compliant authorization artifact after approval."""

        access_request = self._get_request(access_request_id)
        if access_request.status != "Approved":
            raise ValueError(
                "A HIPAA authorization document can only be generated after approval."
            )

        document = self._document_generator(deepcopy(access_request))
        access_request.authorization_document = document
        self._record_audit(
            "consent.authorization.generated",
            actor_id=access_request.provider_id,
            target_id=access_request.request_id,
            metadata={
                "patient_id": access_request.patient_id,
                "provider_id": access_request.provider_id,
                "status": access_request.status,
            },
        )
        return document

    def enforce_two_factor_authentication(self, user_id: str) -> None:
        """Require 2FA before the login flow can continue."""

        if not self._two_factor_enabled_by_user.get(user_id, True):
            raise PermissionError(
                "Two-factor authentication is required for this login attempt."
            )
