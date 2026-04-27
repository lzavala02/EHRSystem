"""Unit tests for newly added patient/provider profile and record management APIs."""

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


def test_patient_can_update_own_provider_list() -> None:
    client = TestClient(api.app)
    token = _login_and_get_token(client, email="patient@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.put(
        "/v1/patients/pat-1/providers",
        headers=headers,
        json={"provider_ids": ["prov-pcp", "prov-derm"]},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["patient_id"] == "pat-1"
    provider_ids = {provider["provider_id"] for provider in payload["providers"]}
    assert "prov-pcp" in provider_ids
    assert "prov-derm" in provider_ids


def test_provider_can_assign_self_to_patient() -> None:
    client = TestClient(api.app)
    token = _login_and_get_token(client, email="provider@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post("/v1/provider/patients/pat-2/assign-self", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["patient_id"] == "pat-2"
    assert payload["provider_id"] == "prov-pcp"
    assert payload["status"] in {"assigned", "already_assigned"}


def test_patient_can_connect_source_system() -> None:
    client = TestClient(api.app)
    token = _login_and_get_token(client, email="patient@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/v1/patients/pat-1/source-systems/connect",
        headers=headers,
        json={"system_name": "Epic"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["patient_id"] == "pat-1"
    assert payload["system_name"] == "Epic"
    assert payload["status"] in {"connected", "already_connected"}
    assert any(
        system["system_name"] == "Epic" for system in payload["connected_systems"]
    )


def test_provider_can_upload_and_edit_medical_history() -> None:
    client = TestClient(api.app)
    token = _login_and_get_token(client, email="provider@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    upload_response = client.post(
        "/v1/patients/pat-1/medical-records/upload",
        headers=headers,
        json={
            "category": "Allergies",
            "value_description": "No known drug allergies",
            "source_system": "NextGen",
        },
    )
    assert upload_response.status_code == 201
    record_id = upload_response.json()["record_id"]

    edit_response = client.patch(
        f"/v1/patients/pat-1/medical-history/{record_id}",
        headers=headers,
        json={"value_description": "Penicillin allergy noted"},
    )

    assert edit_response.status_code == 200
    payload = edit_response.json()
    assert payload["record_id"] == record_id
    assert payload["value_description"] == "Penicillin allergy noted"


def test_patient_and_provider_can_edit_patient_health_profile() -> None:
    client = TestClient(api.app)

    patient_token = _login_and_get_token(client, email="patient@example.com")
    patient_headers = {"Authorization": f"Bearer {patient_token}"}
    patient_response = client.patch(
        "/v1/patients/pat-1/health-profile",
        headers=patient_headers,
        json={"weight": 74.2, "family_history": "Psoriasis, eczema"},
    )
    assert patient_response.status_code == 200
    assert patient_response.json()["patient_profile"]["weight"] == 74.2

    provider_token = _login_and_get_token(client, email="provider@example.com")
    provider_headers = {"Authorization": f"Bearer {provider_token}"}
    provider_response = client.patch(
        "/v1/patients/pat-1/health-profile",
        headers=provider_headers,
        json={"vaccination_record": "Influenza updated 2026"},
    )

    assert provider_response.status_code == 200
    assert (
        provider_response.json()["patient_profile"]["vaccination_record"]
        == "Influenza updated 2026"
    )


def test_patient_cannot_edit_other_patient_health_profile() -> None:
    client = TestClient(api.app)
    token = _login_and_get_token(client, email="patient@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.patch(
        "/v1/patients/pat-2/health-profile",
        headers=headers,
        json={"weight": 68.0},
    )

    assert response.status_code == 403
