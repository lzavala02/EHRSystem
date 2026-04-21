"""Unit tests for API health and readiness endpoints."""

from fastapi.testclient import TestClient

from ehrsystem import api


def test_root_endpoint_reports_api_metadata() -> None:
    """Root should return API metadata and useful discovery links."""

    client = TestClient(api.app)

    response = client.get("/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "api"
    assert payload["health"] == "/health"
    assert payload["docs"] == "/docs"


def test_liveness_endpoint_reports_service_up() -> None:
    """Liveness should return an always-on service status."""

    client = TestClient(api.app)

    response = client.get("/health/live")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "api"


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
