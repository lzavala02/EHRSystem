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


def test_new_provider_can_assign_self_to_patient() -> None:
    client = TestClient(api.app)
    email = "showcase.provider@example.com"
    provider_id: str | None = None

    try:
        register_response = client.post(
            "/v1/auth/register",
            json={
                "email": email,
                "password": "ShowcasePass2!",
                "name": "Showcase Provider",
                "role": "Provider",
            },
        )
        assert register_response.status_code == 200

        provider_id = api.USERS_BY_EMAIL[email.casefold()].provider_id
        assert provider_id is not None

        token = _login_and_get_token(client, email=email, password="ShowcasePass2!")
        headers = {"Authorization": f"Bearer {token}"}

        response = client.post("/v1/provider/patients/pat-2/assign-self", headers=headers)

        assert response.status_code == 200
        payload = response.json()
        assert payload["patient_id"] == "pat-2"
        assert payload["provider_id"] == provider_id
        assert payload["status"] in {"assigned", "already_assigned"}
    finally:
        if provider_id is not None:
            api.PROVIDERS[:] = [
                provider for provider in api.PROVIDERS if provider.provider_id != provider_id
            ]
            api.PROVIDER_BY_ID.pop(provider_id, None)
            api.USERS_BY_ID.pop(api.USERS_BY_EMAIL[email.casefold()].user_id, None)
            api.USERS_BY_EMAIL.pop(email.casefold(), None)
            api._refresh_dashboard_service()


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


def test_new_patient_is_available_in_provider_dashboard_flow() -> None:
    client = TestClient(api.app)
    email = "showcase.patient@example.com"
    patient_id: str | None = None

    try:
        register_response = client.post(
            "/v1/auth/register",
            json={
                "email": email,
                "password": "ShowcasePass1!",
                "name": "Showcase Patient",
                "role": "Patient",
            },
        )
        assert register_response.status_code == 200

        patient_id = api.USERS_BY_EMAIL[email.casefold()].patient_id
        assert patient_id is not None

        provider_token = _login_and_get_token(client, email="provider@example.com")
        headers = {"Authorization": f"Bearer {provider_token}"}

        dashboard_response = client.get(
            f"/v1/dashboard/patients/{patient_id}",
            headers=headers,
        )
        assert dashboard_response.status_code == 200
        dashboard_payload = dashboard_response.json()
        assert dashboard_payload["patient_id"] == patient_id
        assert dashboard_payload["patient_profile"]["height"] is None
        assert dashboard_payload["medical_history"] == []

        sync_response = client.get(
            f"/v1/dashboard/patients/{patient_id}/sync-status",
            headers=headers,
        )
        assert sync_response.status_code == 200
        assert sync_response.json()["patient_id"] == patient_id
        assert sync_response.json()["sync_status"] == []
    finally:
        if patient_id is not None:
            api.PATIENTS[:] = [
                patient for patient in api.PATIENTS if patient.patient_id != patient_id
            ]
            api.PATIENT_BY_ID.pop(patient_id, None)
            api.PATIENT_SOURCE_CONNECTIONS.pop(patient_id, None)
            api.CARE_TEAM_BY_PATIENT.pop(patient_id, None)
            api.SYNC_STATUS_BY_PATIENT.pop(patient_id, None)
            api.USERS_BY_ID.pop(api.USERS_BY_EMAIL[email.casefold()].user_id, None)
            api.USERS_BY_EMAIL.pop(email.casefold(), None)
            api._refresh_dashboard_service()
