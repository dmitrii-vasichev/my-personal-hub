"""Thin async HTTP client for the Personal Hub backend auth endpoints.

Task 3 of Phase 2 only builds this module + tests — `main.py` wires in
`init()` / `shutdown()` in Task 7.
"""

import logging
import re

import httpx

log = logging.getLogger(__name__)

_client: httpx.AsyncClient | None = None


def init(hub_api_url: str, hub_api_token: str) -> None:
    """Construct the module-level AsyncClient. Called once at startup."""
    global _client
    _client = httpx.AsyncClient(
        base_url=hub_api_url.rstrip("/"),
        headers={"Authorization": f"Bearer {hub_api_token}"},
        timeout=httpx.Timeout(5.0, connect=5.0),
    )


async def shutdown() -> None:
    """Close the AsyncClient. Called from main.py's post_shutdown hook."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def _require_client() -> httpx.AsyncClient:
    if _client is None:
        raise RuntimeError("hub_client not initialised")
    return _client


class PinLockedOut(Exception):
    """Raised when the Hub's verify-pin endpoint returns 429 (rate-limited)."""

    def __init__(self, seconds: int):
        super().__init__(f"Locked out. Retry in {seconds}s.")
        self.seconds = seconds


async def check_sender(telegram_user_id: int) -> int | None:
    """Return hub_user_id if the Telegram id is whitelisted, else None.

    Retries exactly once on ``httpx.ConnectError`` (network blip). HTTP 4xx/5xx
    are treated as real and not retried.
    """
    client = _require_client()
    try:
        r = await client.post(
            "/api/telegram/auth/check-sender",
            json={"telegram_user_id": telegram_user_id},
        )
    except httpx.ConnectError:
        log.warning("hub check_sender connect failed; retrying once")
        r = await client.post(
            "/api/telegram/auth/check-sender",
            json={"telegram_user_id": telegram_user_id},
        )
    if r.status_code == 200:
        return int(r.json()["hub_user_id"])
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return None


async def verify_pin(pin: str) -> bool:
    """Verify a user-supplied PIN against the Hub.

    200 → True, 401 → False, 400 → False (PIN not configured).
    429 → raises :class:`PinLockedOut` with the lockout duration parsed from
    the ``detail`` field (format: "Locked out. Retry in Ns.").
    """
    client = _require_client()
    r = await client.post("/api/telegram/auth/verify-pin", json={"pin": pin})
    if r.status_code == 200:
        return bool(r.json().get("ok"))
    if r.status_code == 401:
        return False
    if r.status_code == 429:
        raise PinLockedOut(seconds=_extract_seconds(r.json().get("detail", "")))
    if r.status_code == 400:
        # PIN not configured on the Hub side — treat as auth failure.
        return False
    r.raise_for_status()
    return False


def _extract_seconds(detail: str) -> int:
    m = re.search(r"(\d+)s", detail)
    return int(m.group(1)) if m else 0
