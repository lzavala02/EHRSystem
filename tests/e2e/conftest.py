"""Shared fixtures for E2E tests.

Even though these tests model end-user journeys, they still run in-process and
therefore need explicit state resets to remain deterministic and independent.
"""

from __future__ import annotations

from copy import deepcopy

import pytest

from ehrsystem import api

_BASELINE_CONSENT_REQUESTS = deepcopy(api.CONSENT_SERVICE._access_requests_by_id)
_BASELINE_CONSENT_METADATA = deepcopy(api.CONSENT_REQUEST_METADATA)
_BASELINE_SYMPTOM_LOGS = deepcopy(api.SYMPTOM_LOG_PAYLOADS)
_BASELINE_REPORT_JOBS = deepcopy(api.REPORT_JOBS)
_BASELINE_REPORT_METADATA = deepcopy(api.REPORT_METADATA)
_BASELINE_CHALLENGES = deepcopy(api.CHALLENGES_BY_ID)
_BASELINE_SESSIONS = deepcopy(api.SESSIONS_BY_TOKEN)
_BASELINE_AUDIT_EVENTS = deepcopy(api.AUDIT_EVENT_STORE._events)
_BASELINE_NOTIFICATIONS = deepcopy(api.NOTIFICATION_DISPATCHER._notifications)


@pytest.fixture(autouse=True)
def reset_api_state() -> None:
    """Reset mutable backend state before every E2E scenario."""

    api.CONSENT_SERVICE._access_requests_by_id.clear()
    api.CONSENT_SERVICE._access_requests_by_id.update(
        deepcopy(_BASELINE_CONSENT_REQUESTS)
    )

    api.CONSENT_REQUEST_METADATA.clear()
    api.CONSENT_REQUEST_METADATA.update(deepcopy(_BASELINE_CONSENT_METADATA))

    api.SYMPTOM_LOG_PAYLOADS.clear()
    api.SYMPTOM_LOG_PAYLOADS.extend(deepcopy(_BASELINE_SYMPTOM_LOGS))

    api.REPORT_JOBS.clear()
    api.REPORT_JOBS.update(deepcopy(_BASELINE_REPORT_JOBS))

    api.REPORT_METADATA.clear()
    api.REPORT_METADATA.update(deepcopy(_BASELINE_REPORT_METADATA))

    api.CHALLENGES_BY_ID.clear()
    api.CHALLENGES_BY_ID.update(deepcopy(_BASELINE_CHALLENGES))

    api.SESSIONS_BY_TOKEN.clear()
    api.SESSIONS_BY_TOKEN.update(deepcopy(_BASELINE_SESSIONS))

    api.AUDIT_EVENT_STORE._events.clear()
    api.AUDIT_EVENT_STORE._events.extend(deepcopy(_BASELINE_AUDIT_EVENTS))

    api.NOTIFICATION_DISPATCHER._notifications.clear()
    api.NOTIFICATION_DISPATCHER._notifications.extend(deepcopy(_BASELINE_NOTIFICATIONS))
