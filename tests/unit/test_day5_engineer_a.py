"""Day 5 Engineer A tests for sync adapters, timestamps, and conflict alert wiring."""

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


def test_sync_status_endpoint_returns_per_category_utc_timestamps() -> None:
    """Dashboard sync endpoint should expose UTC freshness per data category."""

    client = TestClient(api.app)
    token = _login_and_get_token(client, email="provider@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/v1/dashboard/patients/pat-1/sync-status", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["patient_id"] == "pat-1"
    categories = {entry["category"] for entry in payload["sync_status"]}
    assert {"Medications", "Labs"}.issubset(categories)
    assert all(entry["last_synced_at"].endswith("+00:00") for entry in payload["sync_status"])


def test_alerts_endpoint_includes_conflict_alerts_from_sync_pipeline() -> None:
    """Provider alerts should include sync conflict alerts emitted by Day 5 adapter flow."""

    client = TestClient(api.app)
    token = _login_and_get_token(client, email="provider@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/v1/alerts", headers=headers)

    assert response.status_code == 200
    alerts = response.json()["alerts"]
    conflict_alerts = [
        alert for alert in alerts if alert["alert_type"] in {"Data Conflict", "SyncConflict"}
    ]
    assert conflict_alerts
    assert any(alert.get("system_id") == "sys-epic" for alert in conflict_alerts)
