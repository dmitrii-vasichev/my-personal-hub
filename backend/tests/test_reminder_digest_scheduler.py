from __future__ import annotations

from datetime import date, datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models.reminder import Reminder, ReminderStatus
from app.models.telegram import PulseSettings
from app.models.user import User, UserRole
from app.services import digest_scheduler


class AsyncSessionAdapter:
    def __init__(self, session: Session):
        self.session = session

    async def execute(self, statement):
        return self.session.execute(statement)


@pytest.mark.asyncio
async def test_reminder_digest_includes_today_anytime_actions(monkeypatch):
    engine = create_engine("sqlite:///:memory:")
    User.__table__.create(engine)
    Reminder.__table__.create(engine)

    sent_messages: list[str] = []

    class FakeBot:
        def __init__(self, token: str):
            self.token = token

        async def send_message(self, *, chat_id: int, text: str, parse_mode: str):
            sent_messages.append(text)

    monkeypatch.setattr("app.core.encryption.decrypt_value", lambda value: "token")
    monkeypatch.setattr("telegram.Bot", FakeBot)

    with Session(engine) as session:
        session.add(
            User(
                id=1,
                email="user@example.com",
                password_hash="hash",
                role=UserRole.member,
                display_name="User",
                must_change_password=False,
                is_blocked=False,
                theme="dark",
                timezone="America/Denver",
            )
        )
        session.add(
            Reminder(
                id=10,
                user_id=1,
                title="Date-only action",
                action_date=date(2026, 5, 5),
                remind_at=None,
                status=ReminderStatus.pending,
                is_floating=True,
                is_urgent=False,
            )
        )
        session.commit()

        settings = PulseSettings()
        settings.user_id = 1
        settings.bot_token = "encrypted"
        settings.bot_chat_id = 12345
        settings.digest_reminders_start_hour = 7
        settings.digest_reminders_end_hour = 22
        settings.digest_reminders_interval_hours = 3
        settings.last_reminder_digest_at = None

        await digest_scheduler._process_user_digest(
            AsyncSessionAdapter(session),
            settings,
            datetime(2026, 5, 5, 16, 0, tzinfo=timezone.utc),
        )

    assert sent_messages
    assert "<b>Today:</b>" in sent_messages[0]
    assert "Date-only action" in sent_messages[0]
