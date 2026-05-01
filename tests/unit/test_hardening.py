"""Day 4 Engineer A integration tests for consent/dashboard hardening."""

from fastapi.testclient import TestClient

from ehrsystem import api  # noqa: F401

REQUIRED_CONSENT_REQUEST_KEYS = {
    "request_id",
    "patient_id",
    "provider_id",
    "provider_name",
    "provider_specialty",
    "reason",
    "status",
    "requested_at",
}

REQUIRED_DASHBOARD_KEYS = {
    "patient_id",
    "patient_profile",
    "source_systems",
    "providers",
    "medical_history",
    "missing_data",
}

REQUIRED_PATIENT_PROFILE_KEYS = {
    "height",
    "weight",
    "vaccination_record",
    "family_history",
}

REQUIRED_SOURCE_SYSTEM_KEYS = {
    "system_id",
    "system_name",
}

REQUIRED_PROVIDER_KEYS = {
    "provider_id",
    "provider_name",
    "specialty",
    "clinic_affiliation",
}

REQUIRED_MEDICAL_HISTORY_KEYS = {
    "record_id",
    "category",
    "value_description",
    "recorded_at",
    "system_id",
    "system_name",
}

REQUIRED_MISSING_DATA_KEYS = {"field_name", "reason"}


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


def test_seeded_consent_notifications_and_audit_events_exist() -> None:
    """Seeded consent requests should have Day 4 notification and audit traces."""

    seeded_request_ids = set(api.CONSENT_REQUEST_METADATA.keys())
    notifications = api.NOTIFICATION_DISPATCHER.list_notifications(recipient_id="pat-1")
    audit_events = api.AUDIT_EVENT_STORE.list_events(
        event_type="consent.request.notified"
    )

    assert len(seeded_request_ids) >= 2
    assert len(notifications) >= len(seeded_request_ids)
    notification_request_ids = {
        notification.metadata.get("request_id") for notification in notifications
    }
    assert seeded_request_ids.issubset(notification_request_ids)

    audit_targets = {event.target_id for event in audit_events}
    assert seeded_request_ids.issubset(audit_targets)


def test_consent_decision_endpoint_keeps_contract_and_records_audit() -> None:
    """Consent decision should keep response shape and append a decision audit event."""

    client = TestClient(api.app)
    token = _login_and_get_token(client, email="patient@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    list_response = client.get("/v1/consent/requests", headers=headers)
    assert list_response.status_code == 200
    request_list = list_response.json()["requests"]
    assert request_list
    assert REQUIRED_CONSENT_REQUEST_KEYS.issubset(request_list[0])

    selected_request = request_list[0]
    decision = "Approve" if selected_request["status"] == "Denied" else "Deny"
    before_count = len(
        api.AUDIT_EVENT_STORE.list_events(event_type="consent.decision.recorded")
    )

    decision_response = client.post(
        f"/v1/consent/requests/{selected_request['request_id']}/decision",
        headers=headers,
        json={"decision": decision},
    )

    assert decision_response.status_code == 200
    payload = decision_response.json()
    assert {"request_id", "status", "responded_at"}.issubset(payload)
    assert payload["status"] in {"Approved", "Denied"}

    after_count = len(
        api.AUDIT_EVENT_STORE.list_events(event_type="consent.decision.recorded")
    )
    assert after_count == before_count + 1


def test_provider_can_create_consent_request_with_notification_and_audit() -> None:
    """Provider should be able to create a request and trigger Day 4 traces."""

    client = TestClient(api.app)
    token = _login_and_get_token(client, email="provider@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    before_created_count = len(
        api.AUDIT_EVENT_STORE.list_events(event_type="consent.request.created")
    )
    before_notified_count = len(
        api.AUDIT_EVENT_STORE.list_events(event_type="consent.request.notified")
    )

    response = client.post(
        "/v1/consent/requests",
        headers=headers,
        json={
            "patient_id": "pat-1",
            "reason": "Dermatology follow-up review",
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert REQUIRED_CONSENT_REQUEST_KEYS.issubset(payload)
    assert payload["patient_id"] == "pat-1"
    assert payload["provider_id"] == "prov-pcp"
    assert payload["status"] == "Pending"

    request_id = payload["request_id"]
    notifications = api.NOTIFICATION_DISPATCHER.list_notifications(recipient_id="pat-1")
    assert any(
        notification.metadata.get("request_id") == request_id
        for notification in notifications
    )

    after_created_count = len(
        api.AUDIT_EVENT_STORE.list_events(event_type="consent.request.created")
    )
    after_notified_count = len(
        api.AUDIT_EVENT_STORE.list_events(event_type="consent.request.notified")
    )
    assert after_created_count == before_created_count + 1
    assert after_notified_count == before_notified_count + 1


def test_dashboard_snapshot_contract_matches_frontend_expectations() -> None:
    """Dashboard response should preserve the Day 2/3 frontend payload contract."""

    client = TestClient(api.app)
    token = _login_and_get_token(client, email="patient@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/v1/dashboard/patients/pat-1", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert REQUIRED_DASHBOARD_KEYS.issubset(payload)

    profile = payload["patient_profile"]
    assert REQUIRED_PATIENT_PROFILE_KEYS.issubset(profile)

    source_systems = payload["source_systems"]
    assert source_systems
    assert REQUIRED_SOURCE_SYSTEM_KEYS.issubset(source_systems[0])
    assert {entry["system_name"] for entry in source_systems} >= {"Epic", "NextGen"}

    providers = payload["providers"]
    assert providers
    assert REQUIRED_PROVIDER_KEYS.issubset(providers[0])

    history_items = payload["medical_history"]
    assert history_items
    assert REQUIRED_MEDICAL_HISTORY_KEYS.issubset(history_items[0])

    missing_data_items = payload["missing_data"]
    if missing_data_items:
        assert REQUIRED_MISSING_DATA_KEYS.issubset(missing_data_items[0])
