"""Integration tests that exercise cross-module API behavior.

These tests validate complete API interactions that span authentication,
consent, symptom logging, report generation, notifications, and auditing.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi.testclient import TestClient

from ehrsystem import api


def _login_and_get_token(
    client: TestClient,
    *,
    email: str,
    password: str = "Passw0rd!",
    code: str = "123456",
) -> str:
    """Authenticate through login and 2FA, then return a bearer token."""

    login_response = client.post(
        "/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_response.status_code == 200
    challenge_id = login_response.json()["challenge_id"]

    verify_response = client.post(
        "/v1/auth/2fa/verify",
        json={"challenge_id": challenge_id, "code": code},
    )
    assert verify_response.status_code == 200
    return verify_response.json()["session_token"]


def test_integration_consent_request_round_trip_records_audit_and_notifications() -> (
    None
):
    """Verify provider->patient consent flow updates state and emits compliance artifacts."""

    client = TestClient(api.app)

    # Step 1: Provider authenticates and creates a new consent request.
    # This checks the full auth handshake (login + 2FA) and provider authorization.
    provider_token = _login_and_get_token(client, email="provider@example.com")
    provider_headers = {"Authorization": f"Bearer {provider_token}"}
    create_response = client.post(
        "/v1/consent/requests",
        headers=provider_headers,
        json={
            "patient_id": "pat-1",
            "reason": "Need review for upcoming care-plan adjustment.",
        },
    )
    assert create_response.status_code == 201
    created_request_id = create_response.json()["request_id"]

    # Step 2: Patient authenticates and confirms that the same request is visible.
    # This validates cross-role visibility rules and metadata wiring in list endpoint.
    patient_token = _login_and_get_token(client, email="patient@example.com")
    patient_headers = {"Authorization": f"Bearer {patient_token}"}
    list_response = client.get("/v1/consent/requests", headers=patient_headers)
    assert list_response.status_code == 200
    request_ids = {item["request_id"] for item in list_response.json()["requests"]}
    assert created_request_id in request_ids

    # Step 3: Patient approves the request, which should trigger authorization generation.
    # This ensures the consent workflow service updates status and response timestamp.
    decision_response = client.post(
        f"/v1/consent/requests/{created_request_id}/decision",
        headers=patient_headers,
        json={"decision": "Approve"},
    )
    assert decision_response.status_code == 200
    assert decision_response.json()["status"] == "Approved"

    # Step 4: Inspect in-memory stores to assert integration side effects.
    # We verify both audit events and notification dispatches were persisted.
    consent_request = api.CONSENT_SERVICE._access_requests_by_id[created_request_id]
    assert consent_request.status == "Approved"
    assert consent_request.authorization_document is not None

    audit_event_types = {
        event.event_type for event in api.AUDIT_EVENT_STORE.list_events()
    }
    assert "consent.request.created" in audit_event_types
    assert "consent.request.notified" in audit_event_types
    assert "consent.decision.recorded" in audit_event_types
    assert "consent.authorization.generated" in audit_event_types

    notifications_for_patient = api.NOTIFICATION_DISPATCHER.list_notifications(
        recipient_id="pat-1"
    )
    assert notifications_for_patient


def test_integration_symptom_logging_to_report_to_quick_share() -> None:
    """Verify symptoms, reports, and sharing integrate across multiple API modules."""

    client = TestClient(api.app)

    # Step 1: Patient logs a symptom with trigger and OTC treatment data.
    # This validates trigger lookup, symptom persistence, and payload serialization.
    patient_token = _login_and_get_token(client, email="patient@example.com")
    patient_headers = {"Authorization": f"Bearer {patient_token}"}

    triggers_response = client.get("/v1/symptoms/triggers", headers=patient_headers)
    assert triggers_response.status_code == 200
    trigger_id = triggers_response.json()["triggers"][0]["trigger_id"]

    log_response = client.post(
        "/v1/symptoms/logs",
        headers=patient_headers,
        json={
            "patient_id": "pat-1",
            "symptom_description": "Skin redness worsened overnight.",
            "severity_scale": 7,
            "trigger_ids": [trigger_id],
            "otc_treatments": ["Hydrocortisone cream"],
        },
    )
    assert log_response.status_code == 201

    # Step 2: Provider generates a trend report for the same patient period.
    # This checks the bridge from symptom data into reporting metadata + job state.
    provider_token = _login_and_get_token(client, email="provider@example.com")
    provider_headers = {"Authorization": f"Bearer {provider_token}"}
    report_response = client.post(
        "/v1/symptoms/reports/trend",
        headers=provider_headers,
        json={
            "patient_id": "pat-1",
            "period_start": datetime(2026, 4, 1, tzinfo=UTC).isoformat(),
            "period_end": datetime(2026, 4, 30, tzinfo=UTC).isoformat(),
        },
    )
    assert report_response.status_code == 202
    report_id = report_response.json()["report_id"]

    # Step 3: Provider checks report status and then quick-shares the report.
    # This confirms report job retrieval and downstream provider collaboration API.
    status_response = client.get(
        f"/v1/reports/{report_id}/status",
        headers=provider_headers,
    )
    assert status_response.status_code == 200
    assert status_response.json()["status"] == "completed"

    metadata_response = client.get(
        f"/v1/reports/{report_id}",
        headers=provider_headers,
    )
    assert metadata_response.status_code == 200
    secure_url = metadata_response.json()["secure_url"]
    assert secure_url.startswith(f"/v1/reports/{report_id}/content?access_token=")
    assert metadata_response.json().get("expires_at")

    content_response = client.get(secure_url, headers=provider_headers)
    assert content_response.status_code == 200
    assert content_response.headers["content-type"].startswith("application/pdf")

    quick_share_response = client.post(
        "/v1/provider/quick-share",
        headers=provider_headers,
        json={
            "patient_id": "pat-1",
            "from_provider_id": "prov-pcp",
            "to_provider_id": "prov-derm",
            "report_id": report_id,
            "message": "Please review trend before dermatology follow-up.",
        },
    )
    assert quick_share_response.status_code == 200
    assert quick_share_response.json()["status"] == "pending"
    assert any(
        share.get("report_id") == report_id for share in api.SECURE_MESSAGE_PAYLOADS
    )

    prefill_response = client.get(
        "/v1/provider/patients/pat-1/quick-share-prefill",
        headers=provider_headers,
    )
    assert prefill_response.status_code == 200
    prefill_payload = prefill_response.json()
    assert prefill_payload["provider_id"] == "prov-pcp"
    assert prefill_payload["fields"]["to_provider_id"] == "prov-derm"
    assert (
        prefill_payload["fields"]["message"]
        == "Please review trend before dermatology follow-up."
    )
    assert prefill_payload["source_timestamp_utc"] is not None

    admin_token = _login_and_get_token(client, email="admin@example.com")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    inbox_response = client.get("/v1/provider/quick-share/inbox", headers=admin_headers)
    assert inbox_response.status_code == 200
    assert inbox_response.json()["total"] >= 1

    # Step 4: Confirm symptom list endpoint now exposes the newly logged entry.
    # This validates that write-path updates are visible through the read-path API.
    logs_response = client.get("/v1/symptoms/logs", headers=patient_headers)
    assert logs_response.status_code == 200
    assert logs_response.json()["total"] >= 1
