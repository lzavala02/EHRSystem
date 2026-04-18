"""Unit tests for Day 3 security baseline and protected API scaffolding."""

from fastapi.testclient import TestClient

from ehrsystem import api


def _login_and_get_token(
    client: TestClient,
    *,
    email: str,
    password: str = "Passw0rd!",
    code: str = "123456",
) -> str:
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


def test_protected_routes_reject_unauthenticated_requests() -> None:
    """Requests without bearer tokens should be rejected with HTTP 401."""

    client = TestClient(api.app)

    response = client.get("/v1/alerts")

    assert response.status_code == 401
    assert response.json()["detail"] == "Missing bearer token"


def test_patient_can_access_own_dashboard_but_not_provider_routes() -> None:
    """Patients should see their dashboard but be blocked from provider-only routes."""

    client = TestClient(api.app)
    token = _login_and_get_token(client, email="patient@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    dashboard_response = client.get("/v1/dashboard/patients/pat-1", headers=headers)
    provider_patients_response = client.get("/v1/provider/patients", headers=headers)

    assert dashboard_response.status_code == 200
    assert dashboard_response.json()["patient_id"] == "pat-1"
    assert provider_patients_response.status_code == 403


def test_patient_cannot_read_another_patients_dashboard() -> None:
    """Patient role should be constrained to the linked patient profile."""

    client = TestClient(api.app)
    token = _login_and_get_token(client, email="patient@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/v1/dashboard/patients/pat-2", headers=headers)

    assert response.status_code == 403


def test_provider_can_use_report_and_quick_share_routes() -> None:
    """Provider role should be able to generate reports and quick-share them."""

    client = TestClient(api.app)
    token = _login_and_get_token(client, email="provider@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    trend_response = client.post(
        "/v1/symptoms/reports/trend",
        headers=headers,
        json={
            "patient_id": "pat-1",
            "period_start": "2026-04-01T00:00:00Z",
            "period_end": "2026-04-18T00:00:00Z",
        },
    )
    assert trend_response.status_code == 200
    report_id = trend_response.json()["report_id"]

    status_response = client.get(f"/v1/reports/{report_id}/status", headers=headers)
    assert status_response.status_code == 200
    assert status_response.json()["status"] == "completed"

    quick_share_response = client.post(
        "/v1/provider/quick-share",
        headers=headers,
        json={
            "patient_id": "pat-1",
            "from_provider_id": "prov-pcp",
            "to_provider_id": "prov-derm",
            "report_id": report_id,
            "message": "Please review before next visit.",
        },
    )

    assert quick_share_response.status_code == 200
    assert quick_share_response.json()["status"] == "pending"


def test_alias_api_prefix_matches_v1_routes() -> None:
    """The /api/v1 alias should expose the same protected API surface."""

    client = TestClient(api.app)
    token = _login_and_get_token(client, email="provider@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/v1/provider/patients", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] >= 1
