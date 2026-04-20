"""Shared in-memory primitives for audit events and notifications.

Day 4 uses these lightweight stores so services can persist compliance events
and notification outcomes while keeping integration points explicit.
"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4


@dataclass(slots=True)
class AuditEvent:
    event_id: str
    event_type: str
    occurred_at: datetime
    actor_id: str | None
    target_id: str | None
    metadata: dict[str, str]


@dataclass(slots=True)
class Notification:
    notification_id: str
    channel: str
    recipient_id: str
    subject: str
    body: str
    created_at: datetime
    metadata: dict[str, str]


class InMemoryAuditEventStore:
    """Persists audit events in process for unit and integration checks."""

    def __init__(self) -> None:
        self._events: list[AuditEvent] = []

    def record_event(
        self,
        *,
        event_type: str,
        actor_id: str | None,
        target_id: str | None,
        metadata: dict[str, str] | None = None,
    ) -> AuditEvent:
        event = AuditEvent(
            event_id=f"audit-{uuid4()}",
            event_type=event_type,
            occurred_at=datetime.now(UTC),
            actor_id=actor_id,
            target_id=target_id,
            metadata=deepcopy(metadata or {}),
        )
        self._events.append(event)
        return deepcopy(event)

    def list_events(self, *, event_type: str | None = None) -> list[AuditEvent]:
        selected = self._events
        if event_type is not None:
            selected = [event for event in self._events if event.event_type == event_type]
        return [deepcopy(event) for event in selected]


class InMemoryNotificationDispatcher:
    """Stores notification dispatch attempts for consent and alert workflows."""

    def __init__(self) -> None:
        self._notifications: list[Notification] = []

    def send(
        self,
        *,
        channel: str,
        recipient_id: str,
        subject: str,
        body: str,
        metadata: dict[str, str] | None = None,
    ) -> Notification:
        notification = Notification(
            notification_id=f"notif-{uuid4()}",
            channel=channel,
            recipient_id=recipient_id,
            subject=subject,
            body=body,
            created_at=datetime.now(UTC),
            metadata=deepcopy(metadata or {}),
        )
        self._notifications.append(notification)
        return deepcopy(notification)

    def list_notifications(
        self, *, recipient_id: str | None = None
    ) -> list[Notification]:
        selected = self._notifications
        if recipient_id is not None:
            selected = [
                notification
                for notification in self._notifications
                if notification.recipient_id == recipient_id
            ]
        return [deepcopy(notification) for notification in selected]
