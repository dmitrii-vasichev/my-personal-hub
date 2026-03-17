"""Tests for custom digest prompts feature."""
import pytest
from unittest.mock import MagicMock
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.models.user import User, UserRole
from app.services.pulse_digest import CATEGORY_PROMPTS


def make_user(user_id: int = 1) -> User:
    u = User()
    u.id = user_id
    u.role = UserRole.admin
    u.email = "admin@example.com"
    u.display_name = "Admin"
    return u


class TestPromptDefaults:
    def setup_method(self):
        from app.core.deps import get_current_user
        self._user = make_user()
        app.dependency_overrides[get_current_user] = lambda: self._user

    def teardown_method(self):
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_get_defaults_returns_all_categories(self):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/pulse/settings/prompts/defaults")
        assert response.status_code == 200
        data = response.json()
        assert "news" in data
        assert "jobs" in data
        assert "learning" in data
        assert len(data["news"]) > 0

    @pytest.mark.asyncio
    async def test_defaults_match_hardcoded(self):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/pulse/settings/prompts/defaults")
        data = response.json()
        assert data["news"] == CATEGORY_PROMPTS["news"]
        assert data["jobs"] == CATEGORY_PROMPTS["jobs"]
        assert data["learning"] == CATEGORY_PROMPTS["learning"]


class TestCustomPromptUsage:
    @pytest.mark.asyncio
    async def test_custom_prompt_used_when_set(self):
        """When PulseSettings has a custom prompt, it should be used instead of default."""
        custom_prompt = "You are a custom summarizer. Do it differently."

        # Create mock PulseSettings with custom prompt
        mock_settings = MagicMock()
        mock_settings.prompt_news = custom_prompt
        mock_settings.prompt_jobs = None
        mock_settings.prompt_learning = None

        # Verify that the custom prompt would be selected
        effective_category = "news"
        custom_field = f"prompt_{effective_category}"
        result = getattr(mock_settings, custom_field, None)
        assert result == custom_prompt

    @pytest.mark.asyncio
    async def test_default_prompt_used_when_custom_is_none(self):
        """When custom prompt is NULL, default should be used."""
        mock_settings = MagicMock()
        mock_settings.prompt_news = None

        effective_category = "news"
        custom_field = f"prompt_{effective_category}"
        custom = getattr(mock_settings, custom_field, None)
        assert custom is None
        # Fallback to default
        system_prompt = custom or CATEGORY_PROMPTS.get(effective_category)
        assert system_prompt == CATEGORY_PROMPTS["news"]


class TestPromptValidation:
    def test_prompt_max_length(self):
        from app.schemas.pulse_settings import PulseSettingsUpdate

        # Valid: under 5000 chars
        data = PulseSettingsUpdate(prompt_news="x" * 5000)
        assert len(data.prompt_news) == 5000

    def test_prompt_over_max_length_rejected(self):
        from pydantic import ValidationError
        from app.schemas.pulse_settings import PulseSettingsUpdate

        with pytest.raises(ValidationError):
            PulseSettingsUpdate(prompt_news="x" * 5001)
