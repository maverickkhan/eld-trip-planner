"""
Plain data structures shared by the HOS engine, the daily-log builder and the
API serializers.  No Django imports here so the engine stays unit-testable in
isolation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum


class DutyStatus(str, Enum):
    """The four duty statuses that appear on an ELD / paper log grid."""

    OFF_DUTY = "off_duty"
    SLEEPER_BERTH = "sleeper_berth"
    DRIVING = "driving"
    ON_DUTY = "on_duty"  # on duty, not driving


class EventType(str, Enum):
    """Why a duty-status segment exists.  Drives labelling and map markers."""

    DRIVE = "drive"
    PICKUP = "pickup"
    DROPOFF = "dropoff"
    FUEL = "fuel"
    BREAK = "break"  # 30-minute break (395.3(a)(3)(ii))
    REST = "rest"  # 10-hour off-duty reset
    RESTART = "restart"  # 34-hour cycle restart
    PRE_TRIP = "pre_trip"  # padding: off duty before the trip starts
    POST_TRIP = "post_trip"  # padding: off duty after the trip ends


STOP_EVENT_TYPES = {
    EventType.PICKUP,
    EventType.DROPOFF,
    EventType.FUEL,
    EventType.BREAK,
    EventType.REST,
    EventType.RESTART,
}


@dataclass
class Leg:
    """A driving leg of the trip, as returned by the routing service."""

    name: str  # e.g. "to_pickup", "to_dropoff"
    distance_miles: float
    duration_hours: float

    @property
    def average_speed_mph(self) -> float:
        if self.duration_hours <= 0:
            return 0.0
        return self.distance_miles / self.duration_hours


@dataclass
class TripPlanRequest:
    """Input to the HOS engine."""

    start_time: datetime  # naive, in the driver's home-terminal local time
    cycle_used_hours: float
    legs: list[Leg]


@dataclass
class DutyEvent:
    """One contiguous duty-status segment on the trip timeline."""

    status: DutyStatus
    event_type: EventType
    start: datetime
    end: datetime
    start_miles: float
    end_miles: float
    label: str
    leg_index: int | None = None
    # 70-hour cycle usage immediately before / after this event (for recaps).
    cycle_used_before: float = 0.0
    cycle_used_after: float = 0.0

    @property
    def duration_hours(self) -> float:
        return (self.end - self.start).total_seconds() / 3600.0

    @property
    def distance_miles(self) -> float:
        return self.end_miles - self.start_miles

    @property
    def is_stop(self) -> bool:
        return self.event_type in STOP_EVENT_TYPES


@dataclass
class ScheduleSummary:
    driving_hours: float
    on_duty_hours: float  # on duty, not driving
    off_duty_hours: float
    sleeper_berth_hours: float
    total_hours: float
    total_miles: float
    fuel_stops: int
    breaks: int
    rests: int
    restarts: int
    cycle_used_at_start: float
    cycle_used_at_end: float
    # Driver clocks immediately after the final event (what is left today).
    driving_hours_remaining: float = 0.0
    window_hours_remaining: float = 0.0
    cycle_hours_remaining: float = 0.0


@dataclass
class Schedule:
    """Output of the HOS engine: a continuous timeline of duty events."""

    start_time: datetime
    end_time: datetime
    events: list[DutyEvent]
    summary: ScheduleSummary


@dataclass
class LogEntry:
    """A duty-status segment clipped to one calendar day (00:00-24:00)."""

    status: DutyStatus
    event_type: EventType
    start: datetime
    end: datetime
    start_miles: float
    end_miles: float
    label: str
    cycle_used_at_end: float = 0.0

    @property
    def start_minute(self) -> int:
        return self.start.hour * 60 + self.start.minute

    @property
    def end_minute(self) -> int:
        # An entry ending exactly at midnight belongs to the previous day and
        # is drawn up to minute 1440.
        if self.end.date() != self.start.date():
            return 24 * 60
        return self.end.hour * 60 + self.end.minute

    @property
    def duration_hours(self) -> float:
        return (self.end - self.start).total_seconds() / 3600.0


@dataclass
class DailyLog:
    """One ELD daily log sheet."""

    date: date
    day_number: int
    entries: list[LogEntry]
    totals: dict[str, float] = field(default_factory=dict)  # status -> hours (sums to 24)
    miles_driven: float = 0.0
    # Paper-log "recap" figures for the 70-hour / 8-day rule.
    on_duty_hours_today: float = 0.0  # driving + on duty (not driving)
    cycle_used_at_end_of_day: float = 0.0
    hours_available_tomorrow: float = 0.0
    # A 34-hour restart that is still running at midnight / that finished today.
    restart_completes_at: datetime | None = None
    restart_completed_at: datetime | None = None
