"""End-to-end tests for realistic patient and provider journeys.

These tests follow full user-facing workflows through auth, protected routes,
and multi-step clinical operations.
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
    """Complete the login + 2FA journey and return an access token."""

    # Authenticate credentials and receive a short-lived challenge identifier.
    login_response = client.post(
        "/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_response.status_code == 200
    challenge_id = login_response.json()["challenge_id"]

    # Verify second factor code to mint an authenticated session token.
    verify_response = client.post(
        "/v1/auth/2fa/verify",
        json={"challenge_id": challenge_id, "code": code},
    )
    assert verify_response.status_code == 200
    return verify_response.json()["session_token"]


def test_e2e_patient_consents_then_views_dashboard_and_logs_out() -> None:
    """Run a patient-oriented journey from sign-in to consent decision and logout."""

    client = TestClient(api.app)

    # Step 1: Patient signs in and obtains a bearer token for protected routes.
    # This simulates the standard credential + 2FA login entry point.
    patient_token = _login_and_get_token(client, email="patient@example.com")
    patient_headers = {"Authorization": f"Bearer {patient_token}"}

    # Step 2: Patient opens consent center and selects a pending request.
    # This validates that seeded requests are visible to the correct patient.
    consent_list_response = client.get("/v1/consent/requests", headers=patient_headers)
    assert consent_list_response.status_code == 200
    requests = consent_list_response.json()["requests"]
    assert requests
    pending_request_id = requests[0]["request_id"]

    # Step 3: Patient approves consent and expects a persisted approval state.
    # This emulates the primary business action in the patient flow.
    decision_response = client.post(
        f"/v1/consent/requests/{pending_request_id}/decision",
        headers=patient_headers,
        json={"decision": "Approve"},
    )
    assert decision_response.status_code == 200
    assert decision_response.json()["status"] == "Approved"

    # Step 4: Patient opens their own dashboard and receives profile + care data.
    # This confirms post-login navigation to a core protected page works.
    dashboard_response = client.get(
        "/v1/dashboard/patients/pat-1", headers=patient_headers
    )
    assert dashboard_response.status_code == 200
    assert dashboard_response.json()["patient_id"] == "pat-1"

    # Step 5: Patient logs out and then can no longer access protected endpoints.
    # This verifies the session invalidation path of the security workflow.
    logout_response = client.post("/v1/auth/logout", headers=patient_headers)
    assert logout_response.status_code == 200

    post_logout_response = client.get("/v1/consent/requests", headers=patient_headers)
    assert post_logout_response.status_code == 401


def test_e2e_provider_logs_symptom_report_and_quick_shares() -> None:
    """Run a provider collaboration journey from patient intake to report sharing."""

    client = TestClient(api.app)

    # Step 1: Patient first logs a symptom entry so report generation has fresh data.
    # This models real-world sequencing where patient data arrives before review.
    patient_token = _login_and_get_token(client, email="patient@example.com")
    patient_headers = {"Authorization": f"Bearer {patient_token}"}

    triggers_response = client.get("/v1/symptoms/triggers", headers=patient_headers)
    assert triggers_response.status_code == 200
    trigger_id = triggers_response.json()["triggers"][0]["trigger_id"]

    symptom_log_response = client.post(
        "/v1/symptoms/logs",
        headers=patient_headers,
        json={
            "patient_id": "pat-1",
            "symptom_description": "Itching increased after stress event.",
            "severity_scale": 8,
            "trigger_ids": [trigger_id],
            "otc_treatments": ["Coal tar shampoo"],
        },
    )
    assert symptom_log_response.status_code == 201

    # Step 2: Provider signs in and requests a trend report for the same patient.
    # This verifies provider role permissions and report job creation behavior.
    provider_token = _login_and_get_token(client, email="provider@example.com")
    provider_headers = {"Authorization": f"Bearer {provider_token}"}

    create_report_response = client.post(
        "/v1/symptoms/reports/trend",
        headers=provider_headers,
        json={
            "patient_id": "pat-1",
            "period_start": datetime(2026, 4, 1, tzinfo=UTC).isoformat(),
            "period_end": datetime(2026, 4, 30, tzinfo=UTC).isoformat(),
        },
    )
    assert create_report_response.status_code == 200
    report_id = create_report_response.json()["report_id"]

    # Step 3: Provider checks report status and metadata before sharing.
    # This mirrors a UI polling step and metadata detail page view.
    report_status_response = client.get(
        f"/v1/reports/{report_id}/status",
        headers=provider_headers,
    )
    assert report_status_response.status_code == 200
    assert report_status_response.json()["status"] == "completed"

    report_metadata_response = client.get(
        f"/v1/reports/{report_id}",
        headers=provider_headers,
    )
    assert report_metadata_response.status_code == 200
    assert report_metadata_response.json()["report_id"] == report_id

    # Step 4: Provider sends a quick-share to another provider.
    # This validates downstream collaboration behavior from completed reports.
    quick_share_response = client.post(
        "/v1/provider/quick-share",
        headers=provider_headers,
        json={
            "patient_id": "pat-1",
            "from_provider_id": "prov-pcp",
            "to_provider_id": "prov-derm",
            "report_id": report_id,
            "message": "Please review before next consultation.",
        },
    )
    assert quick_share_response.status_code == 200
    assert quick_share_response.json()["status"] == "pending"

    # Step 5: Provider confirms the patient roster and alerts are available.
    # This simulates a final dashboard check after completing collaboration tasks.
    provider_patients_response = client.get(
        "/v1/provider/patients", headers=provider_headers
    )
    assert provider_patients_response.status_code == 200
    assert provider_patients_response.json()["total"] >= 1

    alerts_response = client.get("/v1/alerts", headers=provider_headers)
    assert alerts_response.status_code == 200
    assert alerts_response.json()["total"] >= 1
