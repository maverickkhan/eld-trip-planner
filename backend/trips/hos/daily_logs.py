"""
Slice a continuous ``Schedule`` into 24-hour ELD daily log sheets.

Each sheet runs 00:00-24:00 in the driver's home-terminal time.  The first
sheet is padded with off-duty time before the trip starts and the last sheet
with off-duty time after the trip ends, so every sheet totals exactly 24 h.
Each sheet also carries the paper-log "recap" figures for the 70-hour rule.
"""

from __future__ import annotations

from datetime import datetime, time, timedelta

from .models import DailyLog, DutyEvent, DutyStatus, EventType, LogEntry, Schedule
from .rules import DEFAULT_RULES, HOSRules

ON_DUTY_STATUSES = (DutyStatus.DRIVING, DutyStatus.ON_DUTY)


def _midnight(day) -> datetime:
    return datetime.combine(day, time.min)


def _hours(start: datetime, end: datetime) -> float:
    return (end - start).total_seconds() / 3600.0


def _clip_event(event: DutyEvent, day_start: datetime, day_end: datetime) -> LogEntry | None:
    start = max(event.start, day_start)
    end = min(event.end, day_end)
    if end <= start:
        return None

    total_seconds = (event.end - event.start).total_seconds()
    if total_seconds > 0 and event.distance_miles > 0:
        frac_start = (start - event.start).total_seconds() / total_seconds
        frac_end = (end - event.start).total_seconds() / total_seconds
        start_miles = event.start_miles + event.distance_miles * frac_start
        end_miles = event.start_miles + event.distance_miles * frac_end
    else:
        start_miles = end_miles = event.start_miles

    # Cycle usage at the end of this (possibly clipped) segment.
    if end == event.end:
        cycle_at_end = event.cycle_used_after
    elif event.status in ON_DUTY_STATUSES:
        cycle_at_end = event.cycle_used_before + _hours(event.start, end)
    else:
        # Off-duty time never adds hours; a 34-hour restart only resets
        # the cycle once it is complete, i.e. at event.end.
        cycle_at_end = event.cycle_used_before

    return LogEntry(
        status=event.status,
        event_type=event.event_type,
        start=start,
        end=end,
        start_miles=start_miles,
        end_miles=end_miles,
        label=event.label,
        cycle_used_at_end=cycle_at_end,
    )


def build_daily_logs(schedule: Schedule, rules: HOSRules = DEFAULT_RULES) -> list[DailyLog]:
    if not schedule.events:
        return []

    first_day = schedule.start_time.date()
    last_day = schedule.end_time.date()
    # A trip ending exactly at midnight does not need a sheet for the new day.
    if schedule.end_time == _midnight(last_day) and last_day > first_day:
        last_day -= timedelta(days=1)

    initial_cycle = schedule.events[0].cycle_used_before
    final_cycle = schedule.events[-1].cycle_used_after
    final_miles = schedule.events[-1].end_miles
    logs: list[DailyLog] = []
    day = first_day
    day_number = 1

    while day <= last_day:
        day_start = _midnight(day)
        day_end = day_start + timedelta(days=1)
        entries: list[LogEntry] = []

        if day == first_day and schedule.start_time > day_start:
            entries.append(
                LogEntry(
                    status=DutyStatus.OFF_DUTY,
                    event_type=EventType.PRE_TRIP,
                    start=day_start,
                    end=schedule.start_time,
                    start_miles=0.0,
                    end_miles=0.0,
                    label="Off duty (before trip)",
                    cycle_used_at_end=initial_cycle,
                )
            )

        restart_completes_at = None
        restart_completed_at = None
        for event in schedule.events:
            if event.end <= day_start:
                continue
            if event.start >= day_end:
                break
            entry = _clip_event(event, day_start, day_end)
            if entry is not None:
                entries.append(entry)
                if event.event_type is EventType.RESTART:
                    if event.end > day_end:
                        restart_completes_at = event.end
                    else:
                        restart_completed_at = event.end

        if day == last_day and schedule.end_time < day_end:
            entries.append(
                LogEntry(
                    status=DutyStatus.OFF_DUTY,
                    event_type=EventType.POST_TRIP,
                    start=schedule.end_time,
                    end=day_end,
                    start_miles=final_miles,
                    end_miles=final_miles,
                    label="Off duty (trip complete)",
                    cycle_used_at_end=final_cycle,
                )
            )

        totals = {status.value: 0.0 for status in DutyStatus}
        for entry in entries:
            totals[entry.status.value] += entry.duration_hours
        miles_driven = sum(
            entry.end_miles - entry.start_miles
            for entry in entries
            if entry.status is DutyStatus.DRIVING
        )
        on_duty_today = totals[DutyStatus.DRIVING.value] + totals[DutyStatus.ON_DUTY.value]
        cycle_at_end_of_day = entries[-1].cycle_used_at_end if entries else initial_cycle

        logs.append(
            DailyLog(
                date=day,
                day_number=day_number,
                entries=entries,
                totals=totals,
                miles_driven=miles_driven,
                on_duty_hours_today=on_duty_today,
                cycle_used_at_end_of_day=cycle_at_end_of_day,
                hours_available_tomorrow=max(0.0, rules.cycle_limit_hours - cycle_at_end_of_day),
                restart_completes_at=restart_completes_at,
                restart_completed_at=restart_completed_at,
            )
        )
        day += timedelta(days=1)
        day_number += 1

    return logs
