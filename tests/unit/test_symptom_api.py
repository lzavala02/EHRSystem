"""Unit tests for psoriasis-specific symptom API validation rules."""

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


def _first_trigger_id(client: TestClient, headers: dict[str, str]) -> str:
    response = client.get("/v1/symptoms/triggers", headers=headers)
    assert response.status_code == 200
    return response.json()["triggers"][0]["trigger_id"]


def test_create_symptom_log_rejects_non_psoriasis_description() -> None:
    """Symptom API should reject descriptions unrelated to psoriasis symptoms."""

    client = TestClient(api.app)
    token = _login_and_get_token(client, email="patient@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    trigger_id = _first_trigger_id(client, headers)

    response = client.post(
        "/v1/symptoms/logs",
        headers=headers,
        json={
            "patient_id": "pat-1",
            "symptom_description": "Headache after lunch",
            "severity_scale": 5,
            "trigger_ids": [trigger_id],
            "otc_treatments": ["Hydrocortisone cream"],
        },
    )

    assert response.status_code == 422
    assert "psoriasis-oriented symptoms" in response.json()["detail"]


def test_create_symptom_log_rejects_short_description_at_request_boundary() -> None:
    """Request validation should enforce the symptom description length floor."""

    client = TestClient(api.app)
    token = _login_and_get_token(client, email="patient@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    trigger_id = _first_trigger_id(client, headers)

    response = client.post(
        "/v1/symptoms/logs",
        headers=headers,
        json={
            "patient_id": "pat-1",
            "symptom_description": "Too short",
            "severity_scale": 5,
            "trigger_ids": [trigger_id],
            "otc_treatments": ["Hydrocortisone cream"],
        },
    )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert any(
        isinstance(item, dict) and item["loc"][-1] == "symptom_description"
        for item in detail
    )


def test_create_symptom_log_rejects_empty_trigger_selection_at_request_boundary() -> None:
    """Request validation should require at least one trigger selection."""

    client = TestClient(api.app)
    token = _login_and_get_token(client, email="patient@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/v1/symptoms/logs",
        headers=headers,
        json={
            "patient_id": "pat-1",
            "symptom_description": "Psoriasis plaque flare with itching and redness",
            "severity_scale": 5,
            "trigger_ids": [],
            "otc_treatments": ["Hydrocortisone cream"],
        },
    )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert any(isinstance(item, dict) and item["loc"][-1] == "trigger_ids" for item in detail)


def test_create_symptom_log_requires_otc_treatment_for_high_severity() -> None:
    """High-severity entries should require at least one OTC treatment value."""

    client = TestClient(api.app)
    token = _login_and_get_token(client, email="patient@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    trigger_id = _first_trigger_id(client, headers)

    response = client.post(
        "/v1/symptoms/logs",
        headers=headers,
        json={
            "patient_id": "pat-1",
            "symptom_description": "Psoriasis flare with redness and plaque scaling",
            "severity_scale": 8,
            "trigger_ids": [trigger_id],
            "otc_treatments": [],
        },
    )

    assert response.status_code == 422
    assert "severity is 8 or higher" in response.json()["detail"]


def test_create_symptom_log_stores_severity_level() -> None:
    """Symptom logs should expose derived severity level for UI/API consumers."""

    client = TestClient(api.app)
    token = _login_and_get_token(client, email="patient@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    trigger_id = _first_trigger_id(client, headers)

    create_response = client.post(
        "/v1/symptoms/logs",
        headers=headers,
        json={
            "patient_id": "pat-1",
            "symptom_description": "Itching and plaque flare on elbows and scalp",
            "severity_scale": 9,
            "trigger_ids": [trigger_id],
            "otc_treatments": ["Coal tar shampoo"],
        },
    )
    assert create_response.status_code == 201
    created_log_id = create_response.json()["log_id"]

    list_response = client.get("/v1/symptoms/logs", headers=headers)
    assert list_response.status_code == 200

    matching_logs = [
        entry
        for entry in list_response.json()["logs"]
        if entry.get("log_id") == created_log_id
    ]
    assert matching_logs
    assert matching_logs[0]["severity_level"] == "severe"
