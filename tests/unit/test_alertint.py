"""Day 6 Engineer A tests for manual sync conflict handling and alert integration."""

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


def test_sync_conflicts_endpoint_returns_manual_resolution_items() -> None:
    """Provider conflict endpoint should surface unresolved manual-resolution entries."""

    client = TestClient(api.app)
    token = _login_and_get_token(client, email="provider@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/v1/sync/patients/pat-1/conflicts", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["patient_id"] == "pat-1"
    assert payload["total"] >= 1
    assert all(item["requires_manual_resolution"] for item in payload["conflicts"])


def test_sync_conflict_resolution_marks_related_alerts_resolved() -> None:
    """Manual conflict resolution should resolve matching conflict alerts."""

    client = TestClient(api.app)
    token = _login_and_get_token(client, email="provider@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    conflicts_response = client.get("/v1/sync/patients/pat-1/conflicts", headers=headers)
    assert conflicts_response.status_code == 200
    conflicts = conflicts_response.json()["conflicts"]
    assert conflicts

    conflict = conflicts[0]
    resolve_response = client.post(
        "/v1/sync/patients/pat-1/conflicts/resolve",
        headers=headers,
        json={
            "category": conflict["category"],
            "system_name": conflict["system_name"],
            "resolution": "accept_remote",
        },
    )

    assert resolve_response.status_code == 200
    assert resolve_response.json()["status"] == "resolved"

    alerts_response = client.get("/v1/alerts", headers=headers)
    assert alerts_response.status_code == 200
    matching_alerts = [
        alert
        for alert in alerts_response.json()["alerts"]
        if alert.get("patient_id") == "pat-1"
        and str(conflict["category"]).casefold() in str(alert.get("description", "")).casefold()
        and str(conflict["system_name"]).casefold() in str(alert.get("description", "")).casefold()
    ]
    assert matching_alerts
    assert all(alert["status"] == "Resolved" for alert in matching_alerts)


def test_day6_conflict_alerts_require_manual_resolution_language() -> None:
    """Generated conflict alerts should clearly indicate manual resolution requirement."""

    client = TestClient(api.app)
    token = _login_and_get_token(client, email="provider@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/v1/alerts", headers=headers)
    assert response.status_code == 200

    manual_conflict_alerts = [
        alert
        for alert in response.json()["alerts"]
        if alert.get("alert_type") in {"Data Conflict", "SyncConflict"}
        and "manual resolution" in str(alert.get("description", "")).lower()
    ]
    assert manual_conflict_alerts
