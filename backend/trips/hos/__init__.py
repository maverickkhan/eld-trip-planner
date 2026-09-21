"""HOS (Hours of Service) rule engine package - pure Python, no Django."""

from .daily_logs import build_daily_logs
from .engine import HOSEngine, HOSPlanningError
from .models import (
    DailyLog,
    DutyEvent,
    DutyStatus,
    EventType,
    Leg,
    LogEntry,
    Schedule,
    ScheduleSummary,
    TripPlanRequest,
)
from .rules import DEFAULT_RULES, HOSRules

__all__ = [
    "DEFAULT_RULES",
    "DailyLog",
    "DutyEvent",
    "DutyStatus",
    "EventType",
    "HOSEngine",
    "HOSPlanningError",
    "HOSRules",
    "Leg",
    "LogEntry",
    "Schedule",
    "ScheduleSummary",
    "TripPlanRequest",
    "build_daily_logs",
]
