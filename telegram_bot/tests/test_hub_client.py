import asyncio

import httpx
import pytest

import hub_client
from hub_client import PinLockedOut


def _make_mock_client(handler) -> httpx.AsyncClient:
    """Build an AsyncClient wired to a MockTransport handler, matching the
    headers/base_url that production ``init()`` would set."""
    return httpx.AsyncClient(
        base_url="http://testhost",
        headers={"Authorization": "Bearer phub_test_token_value"},
        transport=httpx.MockTransport(handler),
    )


@pytest.fixture(autouse=True)
def _reset_client():
    """Ensure the module-level ``_client`` never leaks between tests."""
    hub_client._client = None
    yield
    hub_client._client = None


# --- check_sender ---------------------------------------------------------


def test_check_sender_200_returns_int():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/telegram/auth/check-sender"
        return httpx.Response(200, json={"hub_user_id": 42})

    hub_client._client = _make_mock_client(handler)
    result = asyncio.run(hub_client.check_sender(12345))
    assert result == 42


def test_check_sender_404_returns_none():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"detail": "not whitelisted"})

    hub_client._client = _make_mock_client(handler)
    result = asyncio.run(hub_client.check_sender(12345))
    assert result is None


def test_check_sender_500_raises():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"detail": "boom"})

    hub_client._client = _make_mock_client(handler)
    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(hub_client.check_sender(12345))


def test_check_sender_retries_on_connect_error():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            raise httpx.ConnectError("boom", request=request)
        return httpx.Response(200, json={"hub_user_id": 7})

    hub_client._client = _make_mock_client(handler)
    result = asyncio.run(hub_client.check_sender(12345))
    assert result == 7
    assert calls["n"] == 2


# --- verify_pin -----------------------------------------------------------


def test_verify_pin_200_returns_true():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/telegram/auth/verify-pin"
        return httpx.Response(200, json={"ok": True})

    hub_client._client = _make_mock_client(handler)
    assert asyncio.run(hub_client.verify_pin("1234")) is True


def test_verify_pin_401_returns_false():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"detail": "wrong pin"})

    hub_client._client = _make_mock_client(handler)
    assert asyncio.run(hub_client.verify_pin("0000")) is False


def test_verify_pin_429_raises_locked_out_with_seconds():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"detail": "Locked out. Retry in 842s."})

    hub_client._client = _make_mock_client(handler)
    with pytest.raises(PinLockedOut) as ei:
        asyncio.run(hub_client.verify_pin("0000"))
    assert ei.value.seconds == 842


def test_verify_pin_400_returns_false():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"detail": "PIN not configured"})

    hub_client._client = _make_mock_client(handler)
    assert asyncio.run(hub_client.verify_pin("1234")) is False


# --- Auth header ----------------------------------------------------------


def test_bearer_header_present_on_every_request():
    seen_headers: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_headers.append(request.headers.get("authorization", ""))
        if request.url.path.endswith("check-sender"):
            return httpx.Response(200, json={"hub_user_id": 1})
        return httpx.Response(200, json={"ok": True})

    hub_client._client = _make_mock_client(handler)
    asyncio.run(hub_client.check_sender(1))
    asyncio.run(hub_client.verify_pin("1234"))

    assert len(seen_headers) == 2
    for h in seen_headers:
        assert h == "Bearer phub_test_token_value"


# --- Uninitialised guard --------------------------------------------------


def test_require_client_raises_when_not_initialised():
    hub_client._client = None
    with pytest.raises(RuntimeError, match="not initialised"):
        asyncio.run(hub_client.check_sender(1))


# --- init / shutdown lifecycle -------------------------------------------


def test_init_sets_base_url_and_auth_header():
    hub_client.init("https://hub.example.com/", "phub_abcdefghij")
    try:
        assert hub_client._client is not None
        assert str(hub_client._client.base_url) == "https://hub.example.com"
        assert (
            hub_client._client.headers.get("authorization")
            == "Bearer phub_abcdefghij"
        )
    finally:
        asyncio.run(hub_client.shutdown())
    assert hub_client._client is None
