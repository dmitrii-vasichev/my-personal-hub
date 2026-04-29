from datetime import date as date_type, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.daily_plan import PlanItemStatus


# ── PlanItem schemas ─────────────────────────────────────────────────────────


class PlanItemBase(BaseModel):
    order: int
    title: str = Field(min_length=1, max_length=500)
    category: Optional[str] = Field(default=None, max_length=100)
    minutes_planned: int = Field(ge=0)
    notes: Optional[str] = None


class PlanItemCreate(PlanItemBase):
    pass


class PlanItemUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=500)
    category: Optional[str] = None
    minutes_planned: Optional[int] = Field(default=None, ge=0)
    minutes_actual: Optional[int] = Field(default=None, ge=0)
    status: Optional[PlanItemStatus] = None
    notes: Optional[str] = None
    order: Optional[int] = None


class PlanItemResponse(PlanItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    plan_id: int
    minutes_actual: Optional[int] = None
    status: PlanItemStatus
    created_at: datetime
    updated_at: datetime


# ── DailyPlan schemas ────────────────────────────────────────────────────────


class DailyPlanCreate(BaseModel):
    date: date_type
    available_minutes: int = Field(ge=0)
    items: list[PlanItemCreate] = []


class DailyPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    date: date_type
    available_minutes: int
    planned_minutes: int
    completed_minutes: int
    adherence_pct: Optional[float] = None
    replans_count: int
    categories_planned: dict
    categories_actual: dict
    items: list[PlanItemResponse] = []
    created_at: datetime
    updated_at: datetime


# ── Planner context (read-only, derived) ─────────────────────────────────────


class ContextReminder(BaseModel):
    id: int
    title: str
    remind_at: Optional[datetime] = None
    action_date: Optional[date_type] = None
    is_urgent: bool


class ContextEvent(BaseModel):
    id: str
    title: str
    start: datetime
    end: datetime


class YesterdaySummary(BaseModel):
    adherence_pct: Optional[float] = None
    completed_minutes: int
    replans_count: int


class PlannerContextResponse(BaseModel):
    date: date_type
    timezone: str
    due_reminders: list[ContextReminder]
    calendar_events: list[ContextEvent]
    yesterday: Optional[YesterdaySummary] = None


# ── Analytics ────────────────────────────────────────────────────────────────


class DailyAnalyticsPoint(BaseModel):
    date: date_type
    adherence: Optional[float] = None
    planned: int
    completed: int
    replans: int


class AnalyticsResponse(BaseModel):
    # ``from`` is a reserved word in Python, so expose it via alias while
    # storing the value under ``from_date`` on the model instance. The
    # ``populate_by_name=True`` option lets callers construct the model
    # using either ``from``/``to`` (the API contract) or ``from_date``/
    # ``to_date`` (the Python-friendly attribute names).
    model_config = ConfigDict(populate_by_name=True)

    from_date: date_type = Field(alias="from")
    to_date: date_type = Field(alias="to")
    days_count: int
    avg_adherence: Optional[float] = None
    total_planned_minutes: int
    total_completed_minutes: int
    minutes_by_category: dict
    longest_streak: int
    replans_total: int
    daily_series: list[DailyAnalyticsPoint]
