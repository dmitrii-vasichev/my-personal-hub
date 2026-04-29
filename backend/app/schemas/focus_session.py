"""Pydantic schemas for the focus_sessions API (D12).

``FocusSessionResponse`` uses ``model_config = ConfigDict(from_attributes=True)``
so the service layer can build it directly from a SQLAlchemy ORM instance.
The ``actual_minutes`` field is derived by the service from
``started_at``/``ended_at`` (not a stored column).
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


PlannedMinutes = Literal[25, 50, 90]


class FocusSessionStart(BaseModel):
    action_id: Optional[int] = None
    plan_item_id: Optional[int] = None
    planned_minutes: PlannedMinutes


class FocusSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    action_id: Optional[int] = None
    plan_item_id: Optional[int] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    planned_minutes: int
    auto_closed: bool
    actual_minutes: Optional[int] = None
    action_title: Optional[str] = None
    plan_item_title: Optional[str] = None


class FocusSessionTodayResponse(BaseModel):
    sessions: list[FocusSessionResponse]
    total_minutes: int = Field(ge=0)
    count: int = Field(ge=0)
