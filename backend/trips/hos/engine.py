"""
FMCSA Hours-of-Service rule engine for property-carrying drivers.

The engine simulates a driver moving through the trip's driving legs and
inserts the stops the regulations require:

* 30-minute break after 8 cumulative driving hours          (395.3(a)(3)(ii))
* 10 consecutive hours off duty once 11 driving hours or the
  14-hour on-duty window are used up                        (395.3(a)(1)-(3))
* 34-hour restart once 70 on-duty hours in 8 days are used  (395.3(b)-(c))
* fuel stop at least every 1,000 miles                      (assessment rule)
* 1 hour on duty for pickup and for drop-off                (assessment rule)

The output is a continuous list of duty-status segments (``DutyEvent``) that
the daily-log builder slices into 24-hour log sheets.

Design notes
------------
* The engine is pure Python with no Django dependency so it can be unit
  tested with plain dataclasses.
* All times are naive ``datetime`` objects in the driver's home-terminal
  local time, which is the clock an ELD log sheet is drawn against.
* ``DriverState`` owns the counters the rules care about and knows how to
  append events; ``HOSEngine`` decides *which* event to append next.
"""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta

from .models import (
    DutyEvent,
    DutyStatus,
    EventType,
    Leg,
    Schedule,
    ScheduleSummary,
    TripPlanRequest,
)
from .rules import DEFAULT_RULES, HOSRules

EPS_HOURS = 1e-6
EPS_MILES = 1e-6  # ~1.6 mm: anything smaller is floating-point residue
MAX_ITERATIONS = 10_000  # guard against a runaway planning loop


class HOSPlanningError(ValueError):
    """Raised when the request cannot be turned into a legal schedule."""


def _hours_between(start: datetime, end: datetime) -> float:
    return (end - start).total_seconds() / 3600.0


@dataclass
class DriverState:
    """Mutable counters for one driver moving through the trip."""

    rules: HOSRules
    now: datetime
    initial_cycle_used: float

    odometer_miles: float = 0.0
    driving_since_reset: float = 0.0  # toward the 11-hour limit
    driving_since_break: float = 0.0  # toward the 8-hour break trigger
    window_start: datetime | None = None  # start of the 14-hour window
    miles_since_fuel: float = 0.0
    non_driving_streak: float = 0.0  # consecutive non-driving hours
    on_duty_by_day: dict[date, float] = field(default_factory=lambda: defaultdict(float))
    events: list[DutyEvent] = field(default_factory=list)

    # ------------------------------------------------------------------ derived

    @property
    def driving_remaining(self) -> float:
        return self.rules.max_driving_hours - self.driving_since_reset

    @property
    def window_remaining(self) -> float:
        if self.window_start is None:
            return self.rules.max_duty_window_hours
        return self.rules.max_duty_window_hours - _hours_between(self.window_start, self.now)

    @property
    def driving_until_break(self) -> float:
        return self.rules.break_required_after_driving_hours - self.driving_since_break

    @property
    def miles_until_fuel(self) -> float:
        return self.rules.fuel_interval_miles - self.miles_since_fuel

    def cycle_used(self, at: datetime | None = None) -> float:
        """On-duty hours counted against the 70-hour / 8-day cycle.

        Hours accrued during this trip are tracked per calendar day so they
        drop out of the rolling 8-day window.  The ``initial_cycle_used``
        figure supplied by the driver has no per-day breakdown, so it is
        treated conservatively: it only clears with a 34-hour restart.
        """
        at = at or self.now
        earliest_day = at.date() - timedelta(days=self.rules.cycle_days - 1)
        trip_hours = sum(h for d, h in self.on_duty_by_day.items() if d >= earliest_day)
        return self.initial_cycle_used + trip_hours

    @property
    def cycle_remaining(self) -> float:
        return self.rules.cycle_limit_hours - self.cycle_used()

    # ---------------------------------------------------------------- mutators

    def _append(
        self,
        status: DutyStatus,
        event_type: EventType,
        hours: float,
        *,
        miles: float = 0.0,
        label: str,
        leg_index: int | None = None,
    ) -> DutyEvent:
        start = self.now
        end = start + timedelta(hours=hours)
        cycle_before = self.cycle_used()
        event = DutyEvent(
            status=status,
            event_type=event_type,
            start=start,
            end=end,
            start_miles=self.odometer_miles,
            end_miles=self.odometer_miles + miles,
            label=label,
            leg_index=leg_index,
            cycle_used_before=cycle_before,
            cycle_used_after=cycle_before,  # mutators update this once counters change
        )
        self.events.append(event)
        self.now = end
        self.odometer_miles += miles
        return event

    def _finish(self, event: DutyEvent) -> DutyEvent:
        """Record the cycle usage after the event's counters have been applied."""
        event.cycle_used_after = self.cycle_used()
        return event

    def _accrue_on_duty(self, start: datetime, end: datetime) -> None:
        """Attribute on-duty hours to calendar days, splitting at midnight."""
        cursor = start
        while cursor < end:
            next_midnight = datetime.combine(cursor.date() + timedelta(days=1), time.min)
            segment_end = min(end, next_midnight)
            self.on_duty_by_day[cursor.date()] += _hours_between(cursor, segment_end)
            cursor = segment_end

    def _open_window(self) -> None:
        if self.window_start is None:
            self.window_start = self.now

    def _note_non_driving(self, hours: float) -> None:
        """Any 30 consecutive non-driving minutes satisfy the break rule."""
        self.non_driving_streak += hours
        if self.non_driving_streak + EPS_HOURS >= self.rules.min_break_hours:
            self.driving_since_break = 0.0

    def absorb_sliver(self, miles: float, hours: float) -> None:
        """Fold a floating-point residue of a leg into the last driving segment.

        Extends that segment's distance *and* time so odometer, driving hours
        and the cycle stay exactly consistent with the leg totals.
        """
        event = self.events[-1] if self.events and self.events[-1].status is DutyStatus.DRIVING else None
        if event is None:  # pragma: no cover - a leg always drives before it ends
            return
        event.end = event.end + timedelta(hours=hours)
        event.end_miles += miles
        self.now = event.end
        self.odometer_miles += miles
        self.miles_since_fuel += miles
        self.driving_since_reset += hours
        self.driving_since_break += hours
        self._accrue_on_duty(event.end - timedelta(hours=hours), event.end)
        self._finish(event)

    def drive(self, hours: float, miles: float, label: str, leg_index: int) -> DutyEvent:
        self._open_window()
        event = self._append(
            DutyStatus.DRIVING, EventType.DRIVE, hours, miles=miles, label=label, leg_index=leg_index
        )
        self.driving_since_reset += hours
        self.driving_since_break += hours
        self.miles_since_fuel += miles
        self.non_driving_streak = 0.0
        self._accrue_on_duty(event.start, event.end)
        return self._finish(event)

    def on_duty(
        self, hours: float, event_type: EventType, label: str, leg_index: int | None = None
    ) -> DutyEvent:
        """On duty, not driving: pickup, drop-off, fuelling."""
        self._open_window()
        event = self._append(DutyStatus.ON_DUTY, event_type, hours, label=label, leg_index=leg_index)
        self._accrue_on_duty(event.start, event.end)
        self._note_non_driving(hours)
        if event_type is EventType.FUEL:
            self.miles_since_fuel = 0.0
        return self._finish(event)

    def take_break(self) -> DutyEvent:
        event = self._append(
            DutyStatus.OFF_DUTY,
            EventType.BREAK,
            self.rules.min_break_hours,
            label="30-minute break",
        )
        self._note_non_driving(event.duration_hours)
        return self._finish(event)

    def rest(self) -> DutyEvent:
        """10 consecutive hours off duty (taken in the sleeper berth)."""
        event = self._append(
            DutyStatus.SLEEPER_BERTH,
            EventType.REST,
            self.rules.min_off_duty_reset_hours,
            label="10-hour rest (sleeper berth)",
        )
        self.driving_since_reset = 0.0
        self.driving_since_break = 0.0
        self.window_start = None
        self.non_driving_streak = 0.0
        return self._finish(event)

    def restart(self) -> DutyEvent:
        """34 consecutive hours off duty: restarts the 70-hour / 8-day cycle."""
        event = self._append(
            DutyStatus.OFF_DUTY,
            EventType.RESTART,
            self.rules.cycle_restart_hours,
            label="34-hour cycle restart",
        )
        self.driving_since_reset = 0.0
        self.driving_since_break = 0.0
        self.window_start = None
        self.non_driving_streak = 0.0
        self.initial_cycle_used = 0.0
        self.on_duty_by_day.clear()
        return self._finish(event)


class HOSEngine:
    """Turns a ``TripPlanRequest`` into an HOS-compliant ``Schedule``."""

    def __init__(self, rules: HOSRules = DEFAULT_RULES):
        self.rules = rules

    # ------------------------------------------------------------------ public

    def plan(self, request: TripPlanRequest) -> Schedule:
        self._validate(request)
        state = DriverState(
            rules=self.rules,
            now=request.start_time,
            initial_cycle_used=request.cycle_used_hours,
        )

        last_index = len(request.legs) - 1
        # On-duty hours still needed after each leg (later legs' driving plus
        # the fixed dwell tasks); fuel stops are ignored, so this is a floor.
        duty_after_leg = []
        for index in range(len(request.legs)):
            later_driving = sum(leg.duration_hours for leg in request.legs[index + 1 :])
            tasks = self.rules.dropoff_hours + (self.rules.pickup_hours if index == 0 else 0.0)
            duty_after_leg.append(later_driving + tasks)

        for index, leg in enumerate(request.legs):
            self._drive_leg(state, leg, index, duty_after_leg[index])
            if index == 0:
                self._perform_task(
                    state, EventType.PICKUP, self.rules.pickup_hours, "Pickup (loading)", index
                )
            if index == last_index:
                self._perform_task(
                    state, EventType.DROPOFF, self.rules.dropoff_hours, "Drop-off (unloading)", index
                )

        return Schedule(
            start_time=request.start_time,
            end_time=state.now,
            events=state.events,
            summary=self._summarise(state, request),
        )

    # ------------------------------------------------------------- validation

    def _validate(self, request: TripPlanRequest) -> None:
        if not request.legs:
            raise HOSPlanningError("At least one driving leg is required.")
        cycle = request.cycle_used_hours
        if not math.isfinite(cycle) or cycle < 0 or cycle > self.rules.cycle_limit_hours:
            raise HOSPlanningError(
                f"cycle_used_hours must be between 0 and {self.rules.cycle_limit_hours:g}."
            )
        for leg in request.legs:
            if not math.isfinite(leg.distance_miles) or not math.isfinite(leg.duration_hours):
                raise HOSPlanningError(f"Leg '{leg.name}' has a non-finite distance or duration.")
            if leg.distance_miles < 0:
                raise HOSPlanningError(f"Leg '{leg.name}' has a negative distance.")
            if leg.distance_miles > EPS_MILES and leg.duration_hours <= 0:
                raise HOSPlanningError(f"Leg '{leg.name}' has a non-positive duration.")

    # ---------------------------------------------------------------- driving

    def _drive_leg(
        self, state: DriverState, leg: Leg, leg_index: int, duty_after_leg_hours: float = 0.0
    ) -> None:
        if leg.distance_miles <= EPS_MILES:
            return

        speed = leg.average_speed_mph
        remaining_miles = leg.distance_miles
        label = f"Driving ({leg.name.replace('_', ' ')})"

        for _ in range(MAX_ITERATIONS):
            if remaining_miles <= EPS_MILES or remaining_miles / speed <= EPS_HOURS:
                if remaining_miles > 0:
                    sliver_hours = remaining_miles / speed
                    if state.miles_since_fuel + remaining_miles <= self.rules.fuel_interval_miles + EPS_MILES:
                        # Fold the floating-point residue into the last driving
                        # segment so the odometer ends exactly at the leg distance.
                        state.absorb_sliver(remaining_miles, sliver_hours)
                    else:
                        # A measurable remainder that would cross a fuel boundary
                        # (only reachable at implausible speeds): fuel first.
                        self._prepare_to_drive(state, sliver_hours, sliver_hours + duty_after_leg_hours)
                        state.drive(sliver_hours, remaining_miles, label, leg_index)
                return

            remaining_hours = remaining_miles / speed
            self._prepare_to_drive(state, remaining_hours, remaining_hours + duty_after_leg_hours)

            limits = {
                "driving": state.driving_remaining,
                "window": state.window_remaining,
                "break": state.driving_until_break,
                "cycle": state.cycle_remaining,
                "fuel": state.miles_until_fuel / speed,
                "leg": remaining_hours,
            }
            chunk_hours = min(limits.values())
            if chunk_hours <= EPS_HOURS:  # pragma: no cover - defensive
                raise HOSPlanningError("Planner could not make progress; limits exhausted.")

            chunk_miles = min(chunk_hours * speed, remaining_miles)
            state.drive(chunk_hours, chunk_miles, label, leg_index)
            remaining_miles -= chunk_miles
            # Whatever limit bound this chunk is handled by _prepare_to_drive
            # on the next iteration.

        raise HOSPlanningError("Planner exceeded the maximum number of iterations.")  # pragma: no cover

    def _prepare_to_drive(
        self, state: DriverState, remaining_leg_hours: float, remaining_trip_duty_hours: float | None = None
    ) -> None:
        """Insert whatever rest/break/fuel stops are needed before driving.

        ``remaining_leg_hours`` lets the engine avoid pointless stops: if the
        leg only needs 6 more minutes of driving and 6 minutes are available,
        it drives instead of taking a 10-hour rest first.

        ``remaining_trip_duty_hours`` (a floor on the on-duty time still
        needed to finish the trip) lets the engine recognise when a 34-hour
        restart is inevitable and take it instead of a 10-hour rest that
        would only be followed by a sliver of work and then the restart.
        """
        rules = self.rules
        # Smallest amount of driving worth doing before we would rather stop.
        min_useful = min(rules.min_useful_driving_hours, remaining_leg_hours)
        if remaining_trip_duty_hours is None:
            remaining_trip_duty_hours = remaining_leg_hours

        for _ in range(MAX_ITERATIONS):
            # 70-hour / 8-day cycle exhausted -> 34-hour restart.
            if state.cycle_remaining < min_useful - EPS_HOURS:
                state.restart()
                continue

            # 11-hour driving limit or 14-hour window exhausted -> 10-hour rest,
            # unless the cycle is nearly gone and a restart is unavoidable.
            if (
                state.driving_remaining < min_useful - EPS_HOURS
                or state.window_remaining < min_useful - EPS_HOURS
            ):
                restart_inevitable = state.cycle_remaining < remaining_trip_duty_hours - EPS_HOURS
                if restart_inevitable and state.cycle_remaining < rules.restart_instead_of_rest_below_cycle_hours:
                    state.restart()
                else:
                    state.rest()
                continue

            # Tank needs filling before the next mile.
            if state.miles_until_fuel <= EPS_MILES:
                if self._ensure_on_duty_capacity(state, rules.fuel_stop_hours):
                    continue  # a rest/restart was inserted; re-evaluate
                state.on_duty(rules.fuel_stop_hours, EventType.FUEL, "Fuel stop")
                continue

            # 8 cumulative driving hours -> 30-minute break, unless a full
            # rest is imminent anyway.
            if state.driving_until_break <= EPS_HOURS:
                capacity_after_break = min(
                    state.driving_remaining,
                    state.window_remaining - rules.min_break_hours,
                    state.cycle_remaining,
                )
                if capacity_after_break < min_useful - EPS_HOURS:
                    state.rest()
                else:
                    state.take_break()
                continue

            return

        raise HOSPlanningError("Planner could not schedule required stops.")  # pragma: no cover

    # -------------------------------------------------------- on-duty tasks

    def _perform_task(
        self, state: DriverState, event_type: EventType, hours: float, label: str, leg_index: int
    ) -> None:
        while self._ensure_on_duty_capacity(state, hours):
            pass
        state.on_duty(hours, event_type, label, leg_index)

    def _ensure_on_duty_capacity(self, state: DriverState, hours: float) -> bool:
        """Make room in the cycle / 14-hour window for a non-driving task.

        The regulations only forbid *driving* past the 14th hour or the
        70-hour cycle, so the task itself would be legal either way; the
        planner is conservative and keeps all on-duty time inside the limits.
        Returns True if a rest or restart was inserted.
        """
        if state.cycle_remaining < hours - EPS_HOURS:
            state.restart()
            return True
        if state.window_remaining < hours - EPS_HOURS:
            state.rest()
            return True
        return False

    # ---------------------------------------------------------------- summary

    def _summarise(self, state: DriverState, request: TripPlanRequest) -> ScheduleSummary:
        hours_by_status: dict[DutyStatus, float] = defaultdict(float)
        counts: dict[EventType, int] = defaultdict(int)
        for event in state.events:
            hours_by_status[event.status] += event.duration_hours
            counts[event.event_type] += 1

        return ScheduleSummary(
            driving_hours=hours_by_status[DutyStatus.DRIVING],
            on_duty_hours=hours_by_status[DutyStatus.ON_DUTY],
            off_duty_hours=hours_by_status[DutyStatus.OFF_DUTY],
            sleeper_berth_hours=hours_by_status[DutyStatus.SLEEPER_BERTH],
            total_hours=_hours_between(request.start_time, state.now),
            total_miles=state.odometer_miles,
            fuel_stops=counts[EventType.FUEL],
            breaks=counts[EventType.BREAK],
            rests=counts[EventType.REST],
            restarts=counts[EventType.RESTART],
            cycle_used_at_start=request.cycle_used_hours,
            cycle_used_at_end=state.cycle_used(),
            driving_hours_remaining=max(state.driving_remaining, 0.0),
            window_hours_remaining=max(state.window_remaining, 0.0),
            cycle_hours_remaining=max(state.cycle_remaining, 0.0),
        )
