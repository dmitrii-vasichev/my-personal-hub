from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reminder import Reminder
from app.models.task import Task
from app.models.user import User
from app.schemas.task_cleanup import (
    PreserveTaskLinkedRemindersResponse,
    TaskLinkedReminderReviewItem,
)


async def list_task_linked_reminder_review(
    db: AsyncSession,
    user: User,
) -> list[TaskLinkedReminderReviewItem]:
    result = await db.execute(
        select(Reminder, Task)
        .join(Task, Reminder.task_id == Task.id)
        .where(
            Reminder.user_id == user.id,
            Task.user_id == user.id,
            Reminder.task_id.is_not(None),
        )
        .order_by(Task.title.asc(), Reminder.action_date.asc(), Reminder.remind_at.asc())
    )

    items: list[TaskLinkedReminderReviewItem] = []
    for reminder, task in result.all():
        checklist = reminder.checklist or []
        items.append(
            TaskLinkedReminderReviewItem(
                task_id=task.id,
                task_title=task.title,
                reminder_id=reminder.id,
                reminder_title=reminder.title,
                action_date=reminder.action_date,
                remind_at=reminder.remind_at,
                is_urgent=reminder.is_urgent,
                recurrence_rule=reminder.recurrence_rule,
                details=reminder.details,
                checklist_count=len(checklist) if isinstance(checklist, list) else 0,
            )
        )
    return items


async def preserve_task_linked_reminders(
    db: AsyncSession,
    user: User,
    reminder_ids: list[int],
) -> PreserveTaskLinkedRemindersResponse:
    if not reminder_ids:
        return PreserveTaskLinkedRemindersResponse(
            preserved_count=0,
            reminder_ids=[],
        )

    result = await db.execute(
        select(Reminder).where(
            Reminder.user_id == user.id,
            Reminder.id.in_(reminder_ids),
            Reminder.task_id.is_not(None),
        )
    )
    reminders = list(result.scalars().all())
    if not reminders:
        return PreserveTaskLinkedRemindersResponse(
            preserved_count=0,
            reminder_ids=[],
        )

    preserved_ids: list[int] = []
    for reminder in reminders:
        reminder.task_id = None
        preserved_ids.append(reminder.id)

    await db.commit()
    return PreserveTaskLinkedRemindersResponse(
        preserved_count=len(preserved_ids),
        reminder_ids=preserved_ids,
    )
