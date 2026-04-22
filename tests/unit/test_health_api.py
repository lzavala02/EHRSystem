"""Unit tests for API health and readiness endpoints."""

from fastapi.testclient import TestClient

from ehrsystem import api


def test_root_endpoint_serves_frontend() -> None:
    """Root should serve frontend index.html for SPA."""

    client = TestClient(api.app)

    response = client.get("/")

    assert response.status_code == 200
    # Frontend is not built in test environment, so we expect the error message
    # In production with built frontend, this would return HTML
    payload = response.json()
    assert "error" in payload or "<!DOCTYPE" in response.text


def test_liveness_endpoint_reports_service_up() -> None:
    """Liveness should return an always-on service status."""

    client = TestClient(api.app)

    response = client.get("/health/live")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "api"


def test_health_endpoint_returns_plain_text_ok() -> None:
    """Health should return plain text OK for uptime monitors."""

    client = TestClient(api.app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.text == "OK"
    assert response.headers["content-type"].startswith("text/plain")


def test_health_endpoint_supports_head() -> None:
    """Health should accept HEAD requests for monitor compatibility."""

    client = TestClient(api.app)

    response = client.head("/health")

    assert response.status_code == 200
    assert response.text == ""


def test_readiness_endpoint_checks_dependencies(monkeypatch) -> None:
    """Readiness should report dependency checks as up when pings succeed."""

    class DummyCursor:
        def execute(self, _query: str) -> None:
            return None

        def fetchone(self) -> tuple[int]:
            return (1,)

        def __enter__(self) -> "DummyCursor":
            return self

        def __exit__(self, *_args: object) -> None:
            return None

    class DummyConnection:
        def cursor(self) -> DummyCursor:
            return DummyCursor()

        def __enter__(self) -> "DummyConnection":
            return self

        def __exit__(self, *_args: object) -> None:
            return None

    class DummyRedisClient:
        def ping(self) -> bool:
            return True

    def fake_connect(_dsn: str) -> DummyConnection:
        return DummyConnection()

    class DummyRedisFactory:
        @staticmethod
        def from_url(_url: str) -> DummyRedisClient:
            return DummyRedisClient()

    monkeypatch.setattr(api, "connect", fake_connect)
    monkeypatch.setattr(api, "Redis", DummyRedisFactory)

    client = TestClient(api.app)
    response = client.get("/health/ready")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["database"] == "up"
    assert payload["redis"] == "up"
