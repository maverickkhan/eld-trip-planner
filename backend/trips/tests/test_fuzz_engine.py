"""
Property-based fuzzing of the HOS engine and daily-log builder.

Each seed builds a random but realistic trip (leg lengths, truck speed,
cycle hours already used, departure time) and asserts every invariant we
promise: FMCSA compliance (independent replay), pickup/drop-off dwell, fuel
cadence, and log-sheet integrity (24 h per sheet, contiguity, mileage,
recap bounds).
"""

import math
import random
from datetime import datetime, time, timedelta

import pytest

from trips.hos import DEFAULT_RULES, DutyStatus, EventType, HOSEngine, build_daily_logs
from trips.presenters import minute_totals
from trips.tests.test_hos_engine import assert_compliant, events_of, make_request

EPS = 1e-6


def random_request(seed: int):
    rng = random.Random(seed)
    to_pickup = rng.choice([0.0, rng.uniform(0.5, 600.0)])
    to_dropoff = rng.uniform(1.0, 4500.0)
    speed = rng.uniform(35.0, 65.0)
    cycle_used = rng.choice([0.0, 70.0, rng.uniform(0.0, 70.0)])
    start = datetime(2026, rng.randint(1, 12), rng.randint(1, 28), rng.randint(0, 23), rng.choice([0, 15, 30, 45]))
    return make_request(to_pickup, to_dropoff, speed_mph=speed, cycle_used=cycle_used, start=start)


@pytest.mark.parametrize("seed", range(400))
def test_random_trip_is_compliant_and_sheets_are_consistent(seed):
    request = random_request(seed)
    total_miles = sum(leg.distance_miles for leg in request.legs)

    schedule = HOSEngine().plan(request)
    assert_compliant(schedule, initial_cycle_used=request.cycle_used_hours)

    # Dwell times and fuel cadence.
    for event_type in (EventType.PICKUP, EventType.DROPOFF):
        (task,) = events_of(schedule, event_type)
        assert task.duration_hours == pytest.approx(1.0)
        assert task.status is DutyStatus.ON_DUTY
    expected_fuel = int((total_miles - 1e-9) // DEFAULT_RULES.fuel_interval_miles)
    assert len(events_of(schedule, EventType.FUEL)) == expected_fuel
    assert schedule.summary.total_miles == pytest.approx(total_miles)

    # Log sheets.
    logs = build_daily_logs(schedule)
    last_day = schedule.end_time.date()
    if schedule.end_time == datetime.combine(last_day, time.min) and last_day > schedule.start_time.date():
        last_day -= timedelta(days=1)
    assert len(logs) == (last_day - schedule.start_time.date()).days + 1

    for log in logs:
        assert sum(log.totals.values()) == pytest.approx(24.0, abs=1e-6)
        assert log.entries[0].start_minute == 0
        assert log.entries[-1].end_minute == 1440
        for previous, current in zip(log.entries, log.entries[1:]):
            assert current.start == previous.end
        assert 0.0 <= log.cycle_used_at_end_of_day <= DEFAULT_RULES.cycle_limit_hours + EPS
        assert log.on_duty_hours_today == pytest.approx(log.totals["driving"] + log.totals["on_duty"])
        # Displayed totals must add up to exactly 24:00 after minute rounding.
        minutes = minute_totals(log.totals)
        assert sum(minutes.values()) == 1440
        for status, hours in log.totals.items():
            assert abs(minutes[status] - hours * 60) < 1.0 + EPS
    assert sum(log.miles_driven for log in logs) == pytest.approx(total_miles)
    assert not math.isnan(schedule.summary.cycle_used_at_end)
