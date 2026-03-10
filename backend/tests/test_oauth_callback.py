"""
Regression tests for Google OAuth callback endpoint.

The callback must be PUBLIC (no JWT required) because Google redirects
the user via browser navigation. User identity comes from the `state` param.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.user import User, UserRole


def make_user(user_id: int = 1) -> User:
    u = User()
    u.id = user_id
    u.role = UserRole.member
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    u.is_blocked = False
    return u


class TestOAuthCallbackStateValidation:
    """Callback must reject invalid state parameters with a redirect."""

    @pytest.mark.asyncio
    async def test_missing_state_redirects_with_error(self):
        from app.api.calendar import google_oauth_callback

        response = await google_oauth_callback(
            code="valid_code",
            state="",
            db=AsyncMock(),
        )
        assert response.status_code == 307
        assert "google=error" in response.headers["location"]
        assert "invalid_state" in response.headers["location"]

    @pytest.mark.asyncio
    async def test_invalid_state_format_redirects_with_error(self):
        from app.api.calendar import google_oauth_callback

        response = await google_oauth_callback(
            code="valid_code",
            state="bad_format",
            db=AsyncMock(),
        )
        assert response.status_code == 307
        assert "invalid_state" in response.headers["location"]

    @pytest.mark.asyncio
    async def test_non_numeric_user_id_redirects_with_error(self):
        from app.api.calendar import google_oauth_callback

        response = await google_oauth_callback(
            code="valid_code",
            state="user_abc",
            db=AsyncMock(),
        )
        assert response.status_code == 307
        assert "invalid_state" in response.headers["location"]


class TestOAuthCallbackUserLookup:
    """Callback must look up user from state and reject unknown users."""

    @pytest.mark.asyncio
    @patch("app.api.calendar.get_user_by_id", new_callable=AsyncMock)
    async def test_unknown_user_redirects_with_error(self, mock_get_user):
        from app.api.calendar import google_oauth_callback

        mock_get_user.return_value = None

        response = await google_oauth_callback(
            code="valid_code",
            state="user_999",
            db=AsyncMock(),
        )
        assert response.status_code == 307
        assert "user_not_found" in response.headers["location"]
        mock_get_user.assert_awaited_once()


class TestOAuthCallbackTokenExchange:
    """Callback must exchange code for tokens and redirect to frontend."""

    @pytest.mark.asyncio
    @patch("app.api.calendar.oauth_service.exchange_code_for_tokens", new_callable=AsyncMock)
    @patch("app.api.calendar.get_user_by_id", new_callable=AsyncMock)
    async def test_successful_exchange_redirects_to_calendar(self, mock_get_user, mock_exchange):
        from app.api.calendar import google_oauth_callback

        user = make_user(user_id=1)
        mock_get_user.return_value = user
        mock_exchange.return_value = MagicMock()

        response = await google_oauth_callback(
            code="valid_code",
            state="user_1",
            db=AsyncMock(),
        )
        assert response.status_code == 307
        assert "google=connected" in response.headers["location"]
        mock_exchange.assert_awaited_once()

    @pytest.mark.asyncio
    @patch("app.api.calendar.oauth_service.exchange_code_for_tokens", new_callable=AsyncMock)
    @patch("app.api.calendar.get_user_by_id", new_callable=AsyncMock)
    async def test_failed_exchange_redirects_with_error(self, mock_get_user, mock_exchange):
        from app.api.calendar import google_oauth_callback

        user = make_user(user_id=1)
        mock_get_user.return_value = user
        mock_exchange.side_effect = Exception("Token exchange failed")

        response = await google_oauth_callback(
            code="invalid_code",
            state="user_1",
            db=AsyncMock(),
        )
        assert response.status_code == 307
        assert "google=error" in response.headers["location"]
        assert "token_exchange_failed" in response.headers["location"]


class TestOAuthCallbackIsPublic:
    """The callback endpoint must NOT require JWT authentication."""

    def test_callback_has_no_current_user_dependency(self):
        """Verify the endpoint signature does not include get_current_user."""
        from app.api.calendar import google_oauth_callback
        import inspect

        sig = inspect.signature(google_oauth_callback)
        param_names = list(sig.parameters.keys())
        assert "current_user" not in param_names, (
            "OAuth callback must not require current_user — "
            "Google redirects users without JWT tokens"
        )
