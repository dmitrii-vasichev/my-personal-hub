# Reminders Phase 1 — Implementation Plan

**Goal:** Build unified Reminders module — standalone reminders + task-linked reminders with Telegram notifications (inline buttons, snooze/done, anti-procrastination).
**Architecture:** New `Reminder` model replaces old task reminder fields. Single notification pipeline. Telegram webhook for inline button callbacks.
**Tech Stack:** FastAPI, SQLAlchemy async, APScheduler, python-telegram-bot (inline keyboards), Next.js, React Query, shadcn.
**Source PRD:** docs/prd-reminders.md

---

### Task 1: Reminder model + PulseSettings fields + migrations

**Files:**
- Create: `backend/app/models/reminder.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/models/telegram.py` (PulseSettings)
- Create: migration for reminders table
- Create: migration for PulseSettings new columns

**Step 1: Create Reminder model**

Create `backend/app/models/reminder.py`:

```python
import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ReminderStatus(str, enum.Enum):
    pending = "pending"
    done = "done"


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    remind_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    status: Mapped[ReminderStatus] = mapped_column(
        Enum(ReminderStatus), default=ReminderStatus.pending, nullable=False
    )
    snoozed_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    recurrence_rule: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True
    )  # "daily", "weekly", "monthly", "yearly"
    snooze_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    notification_sent_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    telegram_message_id: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    task_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    task = relationship("Task", lazy="noload")

    __table_args__ = (
        Index("ix_reminders_user_status", "user_id", "status"),
        Index("ix_reminders_remind_at_status", "remind_at", "status"),
    )
```

**Step 2: Add PulseSettings fields**

Add to `backend/app/models/telegram.py` PulseSettings class (after `prompt_learning`):

```python
# Reminder notification settings
reminder_repeat_count: Mapped[int] = mapped_column(
    Integer, nullable=False, server_default="5"
)
reminder_repeat_interval: Mapped[int] = mapped_column(
    Integer, nullable=False, server_default="5"
)
reminder_snooze_limit: Mapped[int] = mapped_column(
    Integer, nullable=False, server_default="5"
)
```

**Step 3: Update `__init__.py`**

Add imports:
```python
from app.models.reminder import Reminder, ReminderStatus
```
Add to `__all__`:
```python
"Reminder",
"ReminderStatus",
```

**Step 4: Create migrations**

```bash
cd backend
alembic revision -m "create_reminders_table"
alembic revision -m "add_reminder_settings_to_pulse_settings"
```

Write migration code for both, then:
```bash
alembic upgrade head
```

**Step 5: Verify**
```bash
python -c "from app.models.reminder import Reminder, ReminderStatus; print('OK')"
```

**Step 6: Commit**
```bash
git add backend/app/models/reminder.py backend/app/models/__init__.py \
  backend/app/models/telegram.py backend/alembic/versions/
git commit -m "feat: add Reminder model and PulseSettings reminder fields"
```

---

### Task 2: Reminder schemas

**Files:**
- Create: `backend/app/schemas/reminder.py`

**Step 1: Create schemas**

```python
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.reminder import ReminderStatus


class ReminderCreate(BaseModel):
    title: str
    remind_at: datetime
    recurrence_rule: Optional[str] = None
    task_id: Optional[int] = None


class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    remind_at: Optional[datetime] = None
    recurrence_rule: Optional[str] = None


class ReminderSnooze(BaseModel):
    minutes: int  # 15 or 60


class ReminderResponse(BaseModel):
    id: int
    user_id: int
    title: str
    remind_at: datetime
    status: ReminderStatus
    snoozed_until: Optional[datetime]
    recurrence_rule: Optional[str]
    snooze_count: int
    notification_sent_count: int
    task_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    # Derived field for frontend
    task_title: Optional[str] = None

    model_config = {"from_attributes": True}
```

**Step 2: Commit**
```bash
git add backend/app/schemas/reminder.py
git commit -m "feat: add Reminder Pydantic schemas"
```

---

### Task 3: Reminder CRUD service

**Files:**
- Create: `backend/app/services/reminders.py`

**Step 1: Create service**

```python
"""Reminder CRUD service — create, list, update, delete, snooze, done."""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from dateutil.relativedelta import relativedelta
from sqlalchemy import select, and_, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.reminder import Reminder, ReminderStatus
from app.models.task import Task
from app.models.user import User

logger = logging.getLogger(__name__)


async def create_reminder(
    db: AsyncSession, title: str, remind_at: datetime, user: User,
    recurrence_rule: str | None = None, task_id: int | None = None,
) -> Reminder:
    reminder = Reminder(
        user_id=user.id,
        title=title,
        remind_at=remind_at,
        recurrence_rule=recurrence_rule,
        task_id=task_id,
    )
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    return reminder


async def list_reminders(
    db: AsyncSession, user: User, include_done: bool = False,
) -> list[Reminder]:
    """List reminders grouped by date (returned sorted by remind_at)."""
    conditions = [Reminder.user_id == user.id]
    if not include_done:
        conditions.append(Reminder.status == ReminderStatus.pending)
    result = await db.execute(
        select(Reminder)
        .where(and_(*conditions))
        .order_by(Reminder.remind_at)
    )
    return list(result.scalars().all())


async def get_reminder(
    db: AsyncSession, reminder_id: int, user: User,
) -> Optional[Reminder]:
    result = await db.execute(
        select(Reminder).where(
            Reminder.id == reminder_id, Reminder.user_id == user.id
        )
    )
    return result.scalar_one_or_none()


async def update_reminder(
    db: AsyncSession, reminder_id: int, user: User, **kwargs,
) -> Optional[Reminder]:
    reminder = await get_reminder(db, reminder_id, user)
    if not reminder:
        return None
    for key, value in kwargs.items():
        if value is not None:
            setattr(reminder, key, value)
    # Reset notification state if remind_at changed
    if "remind_at" in kwargs:
        reminder.notification_sent_count = 0
        reminder.snoozed_until = None
    await db.commit()
    await db.refresh(reminder)
    return reminder


async def delete_reminder(
    db: AsyncSession, reminder_id: int, user: User,
) -> bool:
    reminder = await get_reminder(db, reminder_id, user)
    if not reminder:
        return False
    await db.delete(reminder)
    await db.commit()
    return True


async def mark_done(
    db: AsyncSession, reminder_id: int, user: User,
) -> Optional[Reminder]:
    reminder = await get_reminder(db, reminder_id, user)
    if not reminder:
        return None

    if reminder.recurrence_rule:
        # Advance to next occurrence
        reminder.remind_at = _next_occurrence(
            reminder.remind_at, reminder.recurrence_rule
        )
        reminder.status = ReminderStatus.pending
        reminder.snooze_count = 0
        reminder.notification_sent_count = 0
        reminder.snoozed_until = None
        reminder.telegram_message_id = None
    else:
        reminder.status = ReminderStatus.done

    await db.commit()
    await db.refresh(reminder)
    return reminder


async def snooze_reminder(
    db: AsyncSession, reminder_id: int, user: User, minutes: int,
) -> Optional[Reminder]:
    reminder = await get_reminder(db, reminder_id, user)
    if not reminder:
        return None

    reminder.snoozed_until = datetime.now(tz=timezone.utc) + timedelta(minutes=minutes)
    reminder.snooze_count += 1
    reminder.notification_sent_count = 0
    reminder.telegram_message_id = None
    await db.commit()
    await db.refresh(reminder)
    return reminder


def _next_occurrence(current: datetime, rule: str) -> datetime:
    """Calculate next occurrence based on recurrence rule."""
    match rule:
        case "daily":
            return current + timedelta(days=1)
        case "weekly":
            return current + timedelta(weeks=1)
        case "monthly":
            return current + relativedelta(months=1)
        case "yearly":
            return current + relativedelta(years=1)
        case _:
            return current + timedelta(days=1)


async def get_reminder_by_task(
    db: AsyncSession, task_id: int, user: User,
) -> Optional[Reminder]:
    """Get reminder linked to a task."""
    result = await db.execute(
        select(Reminder).where(
            Reminder.task_id == task_id, Reminder.user_id == user.id
        )
    )
    return result.scalar_one_or_none()
```

**Step 2: Commit**
```bash
git add backend/app/services/reminders.py
git commit -m "feat: add Reminder CRUD service with snooze and recurrence"
```

---

### Task 4: Reminder API endpoints + router registration

**Files:**
- Create: `backend/app/api/reminders.py`
- Modify: `backend/app/main.py`

**Step 1: Create API router**

```python
"""Reminder API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, restrict_demo
from app.models.user import User
from app.schemas.reminder import (
    ReminderCreate,
    ReminderResponse,
    ReminderSnooze,
    ReminderUpdate,
)
from app.services import reminders as reminder_service

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


def _to_response(r) -> ReminderResponse:
    resp = ReminderResponse.model_validate(r)
    if r.task_id and hasattr(r, "task") and r.task:
        resp.task_title = r.task.title
    return resp


@router.get("/", response_model=list[ReminderResponse])
async def list_reminders(
    include_done: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reminders = await reminder_service.list_reminders(db, current_user, include_done)
    return [_to_response(r) for r in reminders]


@router.post("/", response_model=ReminderResponse, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    data: ReminderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    reminder = await reminder_service.create_reminder(
        db, data.title, data.remind_at, current_user,
        recurrence_rule=data.recurrence_rule, task_id=data.task_id,
    )
    return _to_response(reminder)


@router.patch("/{reminder_id}", response_model=ReminderResponse)
async def update_reminder(
    reminder_id: int,
    data: ReminderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    reminder = await reminder_service.update_reminder(
        db, reminder_id, current_user, **data.model_dump(exclude_unset=True),
    )
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return _to_response(reminder)


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(
    reminder_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    deleted = await reminder_service.delete_reminder(db, reminder_id, current_user)
    if not deleted:
        raise HTTPException(status_code=404, detail="Reminder not found")


@router.post("/{reminder_id}/done", response_model=ReminderResponse)
async def mark_done(
    reminder_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    reminder = await reminder_service.mark_done(db, reminder_id, current_user)
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return _to_response(reminder)


@router.post("/{reminder_id}/snooze", response_model=ReminderResponse)
async def snooze_reminder(
    reminder_id: int,
    data: ReminderSnooze,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    reminder = await reminder_service.snooze_reminder(
        db, reminder_id, current_user, data.minutes,
    )
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return _to_response(reminder)
```

**Step 2: Register in main.py**

Add import:
```python
from app.api.reminders import router as reminders_router
```

Add router:
```python
app.include_router(reminders_router)
```

**Step 3: Commit**
```bash
git add backend/app/api/reminders.py backend/app/main.py
git commit -m "feat: add Reminder API endpoints"
```

---

### Task 5: Telegram notification service with inline buttons

**Files:**
- Create: `backend/app/services/reminder_notifications.py`

**Step 1: Create notification service**

```python
"""Reminder notification service — Telegram inline buttons, repeating, anti-procrastination."""
import logging
from datetime import datetime, timezone
from typing import Any

from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.error import TelegramError

logger = logging.getLogger(__name__)


def _build_keyboard(
    reminder_id: int, snooze_count: int, snooze_limit: int,
) -> InlineKeyboardMarkup:
    """Build inline keyboard based on snooze count vs limit."""
    if snooze_count >= snooze_limit:
        # Anti-procrastination gate: no quick-snooze
        return InlineKeyboardMarkup([
            [InlineKeyboardButton("Done", callback_data=f"rem_done_{reminder_id}")],
            [InlineKeyboardButton(
                "Open in Hub", url=f"/reminders",
            )],
        ])
    else:
        return InlineKeyboardMarkup([
            [
                InlineKeyboardButton("15 min", callback_data=f"rem_snooze_15_{reminder_id}"),
                InlineKeyboardButton("1 hour", callback_data=f"rem_snooze_60_{reminder_id}"),
            ],
            [InlineKeyboardButton("Done", callback_data=f"rem_done_{reminder_id}")],
        ])


def _format_message(title: str, snooze_count: int, time_str: str) -> str:
    """Format notification message with snooze escalation."""
    if snooze_count >= 5:
        prefix = f"\U0001f534 (snoozed {snooze_count}x)"
    elif snooze_count >= 3:
        prefix = f"\U0001f7e0 (snoozed {snooze_count}x)"
    else:
        prefix = "\U0001f514"

    text = f"{prefix} {title}\n\U0001f552 {time_str}"

    if snooze_count >= 5:
        text += "\n\u26a0\ufe0f Quick snooze disabled. Open Hub to reschedule."

    return text


async def send_reminder_notification(
    bot_token: str,
    chat_id: int,
    reminder_id: int,
    title: str,
    time_str: str,
    snooze_count: int,
    snooze_limit: int,
    hub_url: str = "",
) -> dict[str, Any]:
    """Send reminder notification with inline buttons."""
    try:
        bot = Bot(token=bot_token)
        text = _format_message(title, snooze_count, time_str)
        keyboard = _build_keyboard(reminder_id, snooze_count, snooze_limit)

        # Update Hub URL for "Open in Hub" button
        if hub_url:
            for row in keyboard.inline_keyboard:
                for btn in row:
                    if btn.url and btn.url == "/reminders":
                        btn._url = f"{hub_url}/reminders"

        msg = await bot.send_message(
            chat_id=chat_id, text=text, reply_markup=keyboard,
        )
        return {"success": True, "message_id": msg.message_id, "error": None}
    except TelegramError as e:
        logger.warning("Reminder notification failed: %s", e)
        return {"success": False, "message_id": None, "error": str(e)}
    except Exception as e:
        logger.error("Unexpected error sending reminder: %s", e)
        return {"success": False, "message_id": None, "error": str(e)}
```

**Step 2: Commit**
```bash
git add backend/app/services/reminder_notifications.py
git commit -m "feat: add Telegram reminder notification with inline buttons"
```

---

### Task 6: Telegram callback webhook handler

**Files:**
- Modify: `backend/app/api/telegram.py`

**Step 1: Add callback handler endpoint**

Add to existing telegram.py router:

```python
from telegram import Update
from app.services import reminders as reminder_service
from app.models.reminder import Reminder


@router.post("/reminder-callback")
async def handle_reminder_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle Telegram inline button callbacks for reminders."""
    body = await request.json()
    
    callback_query = body.get("callback_query")
    if not callback_query:
        return {"ok": True}
    
    data = callback_query.get("data", "")
    callback_id = callback_query.get("id")
    chat_id = callback_query["message"]["chat"]["id"]
    
    # Parse callback data: rem_done_{id}, rem_snooze_15_{id}, rem_snooze_60_{id}
    parts = data.split("_")
    if len(parts) < 3 or parts[0] != "rem":
        return {"ok": True}
    
    action = parts[1]
    
    if action == "done":
        reminder_id = int(parts[2])
        # Find user by chat_id
        user = await _get_user_by_chat_id(db, chat_id)
        if user:
            await reminder_service.mark_done(db, reminder_id, user)
            await _answer_callback(body, callback_id, "Done!")
    
    elif action == "snooze":
        minutes = int(parts[2])
        reminder_id = int(parts[3])
        user = await _get_user_by_chat_id(db, chat_id)
        if user:
            await reminder_service.snooze_reminder(db, reminder_id, user, minutes)
            await _answer_callback(body, callback_id, f"Snoozed {minutes} min")
    
    return {"ok": True}
```

Helper functions: `_get_user_by_chat_id` (query PulseSettings → user_id → User), `_answer_callback` (answer callback query via Bot API).

**Step 2: Commit**
```bash
git add backend/app/api/telegram.py
git commit -m "feat: add Telegram callback webhook for reminder buttons"
```

---

### Task 7: Scheduler job — unified reminder check

**Files:**
- Create: `backend/app/services/reminder_scheduler.py`
- Modify: `backend/app/main.py` (replace old task_reminder_check)

**Step 1: Create scheduler service**

```python
"""Unified reminder scheduler — replaces old task_reminders.run_reminder_check."""
import logging
from datetime import datetime, timezone

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reminder import Reminder, ReminderStatus
from app.models.telegram import PulseSettings

logger = logging.getLogger(__name__)


async def run_reminder_check() -> None:
    """Scheduled job: find due reminders, send Telegram notifications."""
    from app.core.database import async_session_factory
    from app.core.encryption import decrypt_value
    from app.services.reminder_notifications import send_reminder_notification

    async with async_session_factory() as db:
        try:
            now = datetime.now(tz=timezone.utc)

            result = await db.execute(
                select(Reminder).where(
                    and_(
                        Reminder.status == ReminderStatus.pending,
                        Reminder.remind_at <= now,
                        # Either not snoozed, or snooze expired
                        (Reminder.snoozed_until.is_(None)) | (Reminder.snoozed_until <= now),
                    )
                )
            )
            reminders = list(result.scalars().all())
            if not reminders:
                return

            # Group by user_id
            by_user: dict[int, list[Reminder]] = {}
            for r in reminders:
                by_user.setdefault(r.user_id, []).append(r)

            for user_id, user_reminders in by_user.items():
                ps_result = await db.execute(
                    select(PulseSettings).where(PulseSettings.user_id == user_id)
                )
                ps = ps_result.scalar_one_or_none()
                if not ps or not ps.bot_token or not ps.bot_chat_id:
                    continue

                token = decrypt_value(ps.bot_token)
                max_notifications = ps.reminder_repeat_count
                snooze_limit = ps.reminder_snooze_limit
                tz_name = ps.timezone or "UTC"

                for reminder in user_reminders:
                    if reminder.notification_sent_count >= max_notifications:
                        continue

                    # Format time in user's timezone
                    try:
                        from zoneinfo import ZoneInfo
                        local_dt = reminder.remind_at.astimezone(ZoneInfo(tz_name))
                        time_str = local_dt.strftime("%b %d, %Y %I:%M %p")
                    except Exception:
                        time_str = reminder.remind_at.strftime("%b %d, %Y %H:%M UTC")

                    res = await send_reminder_notification(
                        bot_token=token,
                        chat_id=ps.bot_chat_id,
                        reminder_id=reminder.id,
                        title=reminder.title,
                        time_str=time_str,
                        snooze_count=reminder.snooze_count,
                        snooze_limit=snooze_limit,
                    )
                    if res["success"]:
                        reminder.notification_sent_count += 1
                        if res.get("message_id"):
                            reminder.telegram_message_id = res["message_id"]

                await db.commit()
                logger.info(
                    "Sent %d reminder notification(s) for user %s",
                    len(user_reminders), user_id,
                )

        except Exception as e:
            logger.error("Reminder check failed: %s", e)
```

**Step 2: Update main.py scheduler**

Replace old `task_reminder_check` job:
```python
# Replace:
# "app.services.task_reminders:run_reminder_check"
# With:
scheduler.add_job(
    "app.services.reminder_scheduler:run_reminder_check",
    "interval",
    minutes=2,
    id="reminder_check",
    replace_existing=True,
    misfire_grace_time=120,
)
```

**Step 3: Commit**
```bash
git add backend/app/services/reminder_scheduler.py backend/app/main.py
git commit -m "feat: add unified reminder scheduler (replaces task_reminders)"
```

---

### Task 8: Data migration + refactor task service

**Files:**
- Create: migration to convert existing task reminders to Reminder records
- Modify: `backend/app/services/task.py` (create/update Reminder when reminder_at set)
- Modify: `backend/app/schemas/task.py` (keep reminder_at in API for backwards compat)

**Step 1: Create data migration**

Alembic migration that:
1. SELECT all tasks WHERE reminder_at IS NOT NULL
2. For each: INSERT into reminders (user_id, title, remind_at, status, task_id)
   - If reminder_dismissed = True → status = done
   - Otherwise → status = pending

```bash
alembic revision -m "migrate_task_reminders_to_reminders_table"
```

**Step 2: Refactor task service**

In `backend/app/services/task.py`, when creating/updating a task with `reminder_at`:
- Create/update a linked Reminder record instead of setting `reminder_at` on task
- On task delete cascade: Reminder with task_id FK auto-deletes

```python
# In create_task, after db.commit():
if data.reminder_at:
    from app.services.reminders import create_reminder
    await create_reminder(db, task.title, data.reminder_at, user, task_id=task.id)

# In update_task, if reminder_at is being set/changed:
if "reminder_at" in update_data:
    from app.services.reminders import get_reminder_by_task, create_reminder, update_reminder
    existing = await get_reminder_by_task(db, task.id, user)
    if update_data["reminder_at"]:
        if existing:
            await update_reminder(db, existing.id, user, remind_at=update_data["reminder_at"])
        else:
            await create_reminder(db, task.title, update_data["reminder_at"], user, task_id=task.id)
    elif existing:
        # reminder_at cleared → delete linked reminder
        from app.services.reminders import delete_reminder
        await delete_reminder(db, existing.id, user)
```

**Step 3: Commit**
```bash
git add backend/alembic/versions/ backend/app/services/task.py
git commit -m "feat: migrate task reminders to Reminder model + refactor task service"
```

---

### Task 9: Remove old task reminder code

**Files:**
- Modify: `backend/app/api/tasks.py` (remove /reminders/due and /dismiss endpoints)
- Delete or deprecate: `backend/app/services/task_reminders.py`
- Modify: `backend/app/main.py` (remove old scheduler job reference)
- Modify: `backend/app/services/telegram_notifications.py` (remove send_task_reminder_notification)

**Step 1: Remove old API endpoints**

Remove from `backend/app/api/tasks.py`:
- `get_due_reminders` endpoint
- `dismiss_reminder` endpoint
- `import reminder_service` reference

**Step 2: Remove old service**

Delete `backend/app/services/task_reminders.py` (replaced by reminder_scheduler.py)

**Step 3: Remove old Telegram function**

Remove `send_task_reminder_notification` from `telegram_notifications.py`

**Step 4: Create migration to drop old columns (optional, can defer)**

```bash
alembic revision -m "drop_task_reminder_fields"
```

Drop: `reminder_at`, `reminder_dismissed`, `reminder_telegram_sent` from tasks table.
Also update Task model to remove these fields.

**Step 5: Commit**
```bash
git add -A
git commit -m "refactor: remove old task reminder code, replace with unified Reminder"
```

---

### Task 10: Frontend — types + hooks

**Files:**
- Create: `frontend/src/types/reminder.ts`
- Create: `frontend/src/hooks/use-reminders.ts`

**Step 1: Create types**

```typescript
export type ReminderStatus = "pending" | "done";

export interface Reminder {
  id: number;
  user_id: number;
  title: string;
  remind_at: string;
  status: ReminderStatus;
  snoozed_until: string | null;
  recurrence_rule: string | null;
  snooze_count: number;
  notification_sent_count: number;
  task_id: number | null;
  task_title: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReminderInput {
  title: string;
  remind_at: string;
  recurrence_rule?: string;
  task_id?: number;
}

export interface UpdateReminderInput {
  title?: string;
  remind_at?: string;
  recurrence_rule?: string;
}
```

**Step 2: Create hooks**

```typescript
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Reminder, CreateReminderInput, UpdateReminderInput } from "@/types/reminder";

const REMINDERS_KEY = "reminders";

export function useReminders(includeDone = false) {
  return useQuery<Reminder[]>({
    queryKey: [REMINDERS_KEY, { includeDone }],
    queryFn: () => api.get<Reminder[]>(`/api/reminders?include_done=${includeDone}`),
  });
}

export function useCreateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateReminderInput) =>
      api.post<Reminder>("/api/reminders", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [REMINDERS_KEY] }),
  });
}

export function useUpdateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateReminderInput & { id: number }) =>
      api.patch<Reminder>(`/api/reminders/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [REMINDERS_KEY] }),
  });
}

export function useDeleteReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/reminders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [REMINDERS_KEY] }),
  });
}

export function useMarkDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<Reminder>(`/api/reminders/${id}/done`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [REMINDERS_KEY] }),
  });
}

export function useSnoozeReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, minutes }: { id: number; minutes: number }) =>
      api.post<Reminder>(`/api/reminders/${id}/snooze`, { minutes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [REMINDERS_KEY] }),
  });
}
```

**Step 3: Commit**
```bash
git add frontend/src/types/reminder.ts frontend/src/hooks/use-reminders.ts
git commit -m "feat: add Reminder frontend types and React Query hooks"
```

---

### Task 11: Frontend — Reminders list page + quick-add

**Files:**
- Create: `frontend/src/app/(dashboard)/reminders/page.tsx`
- Create: `frontend/src/components/reminders/reminder-list.tsx`
- Create: `frontend/src/components/reminders/quick-add-form.tsx`

**Step 1: Create reminder list component**

Groups reminders by date (Today, Tomorrow, specific dates).
Each item shows: time (large), title, snooze badge (grey/orange/red based on count).
Actions per item: Done button, Snooze dropdown (15min, 1hr), Delete.
Task-linked reminders show "Task" badge with link.

**Step 2: Create quick-add form**

Compact form at top of page:
- Title input (text)
- Date/time picker (shadcn DateTimePicker or equivalent)
- Submit button

**Step 3: Create page**

Composes quick-add + list. Uses hooks from Task 10.

**Step 4: Commit**
```bash
git add frontend/src/app/\(dashboard\)/reminders/ frontend/src/components/reminders/
git commit -m "feat: add Reminders list page with quick-add form"
```

---

### Task 12: Frontend — sidebar + settings + ReminderPoller refactor

**Files:**
- Modify: `frontend/src/components/layout/sidebar.tsx`
- Modify: Settings page (add reminder settings section)
- Modify: `frontend/src/components/tasks/reminder-poller.tsx`
- Modify: `frontend/src/hooks/use-task-reminders.ts`

**Step 1: Add sidebar nav item**

In `sidebar.tsx`, add to navItems array (after Tasks):
```typescript
import { Bell } from "lucide-react";

// In navItems, after Tasks:
{ label: "Reminders", href: "/reminders", icon: Bell },
```

**Step 2: Update Settings page**

Add "Reminders" section to settings with:
- Repeat count input (number)
- Repeat interval input (number, minutes)
- Snooze limit input (number)

Wire to PulseSettings API (existing endpoint, add new fields to schema).

**Step 3: Refactor ReminderPoller**

Update `reminder-poller.tsx` to use new `/api/reminders` API instead of old
`/api/tasks/reminders/due`. Poll for reminders where `remind_at <= now + 15min`.

Or: simplify to just poll `/api/reminders` with a filter, and show toasts for
due reminders. Snooze count badges in toast.

**Step 4: Remove old hooks**

Replace `use-task-reminders.ts` with redirect to new `use-reminders.ts` hooks,
or update all import sites.

**Step 5: Commit**
```bash
git add frontend/src/components/layout/sidebar.tsx \
  frontend/src/components/tasks/reminder-poller.tsx \
  frontend/src/hooks/
git commit -m "feat: add Reminders to sidebar, refactor poller to unified API"
```

---

### Task 13: Verification

**Step 1: Backend build check**
```bash
cd backend && python -c "from app.main import app; print('OK')"
```

**Step 2: Frontend build check**
```bash
cd frontend && npm run build 2>&1 | tail -20
```

**Step 3: Lint**
```bash
cd backend && ruff check . 2>&1 | tail -20
cd frontend && npm run lint 2>&1 | tail -20
```

**Step 4: Smoke test — API**
```bash
# Create reminder
curl -X POST http://localhost:8000/api/reminders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test reminder", "remind_at": "2026-04-06T20:00:00Z"}'

# List reminders
curl http://localhost:8000/api/reminders -H "Authorization: Bearer $TOKEN"

# Mark done
curl -X POST http://localhost:8000/api/reminders/1/done -H "Authorization: Bearer $TOKEN"
```

**Step 5: Smoke test — Telegram**

Verify scheduler sends notification with inline buttons. Check bot messages.

**Step 6: Regression**
```bash
cd backend && python -m pytest tests/ -x 2>&1 | tail -30
cd frontend && npm test 2>&1 | tail -30
```
