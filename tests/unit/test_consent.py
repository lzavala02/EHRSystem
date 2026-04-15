"""Unit tests for the secure digital consent workflow."""

from ehrsystem.consent import ConsentWorkflowService


def test_consent_workflow_approves_and_generates_document() -> None:
    """Verify access requests, 2FA enforcement, and document generation."""

    service = ConsentWorkflowService(two_factor_enabled_by_user={"patient-1": True})
    request = service.create_access_request("pat-1", "prov-1")

    service.notify_patient(request.request_id)
    updated_request = service.respond_to_request(request.request_id, "Approve")
    document = service.generate_digital_authorization_document(request.request_id)

    assert updated_request.status == "Approved"
    assert "HIPAA Digital Authorization Document" in document
    service.enforce_two_factor_authentication("patient-1")


def test_consent_workflow_rejects_invalid_login_without_two_factor() -> None:
    """Verify the mandatory 2FA rule blocks login when the flag is disabled."""

    service = ConsentWorkflowService(two_factor_enabled_by_user={"patient-2": False})

    try:
        service.enforce_two_factor_authentication("patient-2")
    except PermissionError:
        assert True
    else:
        raise AssertionError("Expected 2FA enforcement to reject the login attempt")
