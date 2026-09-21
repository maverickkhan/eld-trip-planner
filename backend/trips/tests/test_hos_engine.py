"""
Unit tests for the HOS rule engine.

Besides scenario-specific assertions, every generated schedule is run through
``assert_compliant`` - an independent re-implementation of the HOS rules that
replays the event list and fails on any violation.  This guards against the
planner and the checker sharing the same blind spot in a single code path.
"""

from datetime import datetime, timedelta

import pytest

from trips.hos import (
    DEFAULT_RULES,
    DutyStatus,
    EventType,
    HOSEngine,
    HOSPlanningError,
    HOSRules,
    Leg,
    TripPlanRequest,
    build_daily_logs,
)

EPS = 1e-6
START = datetime(2026, 9, 21, 6, 0)  # Monday 06:00


def make_request(to_pickup_miles, to_dropoff_miles, *, speed_mph=60.0, cycle_used=0.0, start=START):
    legs = [
        Leg("to_pickup", to_pickup_miles, to_pickup_miles / speed_mph),
        Leg("to_dropoff", to_dropoff_miles, to_dropoff_miles / speed_mph),
    ]
    return TripPlanRequest(start_time=start, cycle_used_hours=cycle_used, legs=legs)


def hours_between(a, b):
    return (b - a).total_seconds() / 3600.0


def assert_compliant(schedule, rules=DEFAULT_RULES, initial_cycle_used=0.0):
    """Replay the schedule and assert every FMCSA limit is respected."""
    events = schedule.events
    assert events, "schedule has no events"
    assert events[0].start == schedule.start_time
    assert events[-1].end == schedule.end_time

    for previous, current in zip(events, events[1:]):
        assert current.start == previous.end, "events must be contiguous"
        assert current.start_miles == pytest.approx(previous.end_miles)

    driving_since_reset = 0.0
    driving_since_break = 0.0
    non_driving_streak = 0.0
    off_duty_streak = 0.0
    window_start = None
    cycle_used = initial_cycle_used
    miles_since_fuel = 0.0

    for event in events:
        hours = event.duration_hours
        assert hours > 0

        if event.status in (DutyStatus.OFF_DUTY, DutyStatus.SLEEPER_BERTH):
            assert event.distance_miles == pytest.approx(0.0)
            off_duty_streak += hours
            non_driving_streak += hours
            if off_duty_streak + EPS >= rules.cycle_restart_hours:
                cycle_used = 0.0
            if off_duty_streak + EPS >= rules.min_off_duty_reset_hours:
                driving_since_reset = 0.0
                window_start = None
            if non_driving_streak + EPS >= rules.min_break_hours:
                driving_since_break = 0.0
            continue

        off_duty_streak = 0.0
        if window_start is None:
            window_start = event.start

        if event.status is DutyStatus.DRIVING:
            assert driving_since_break < rules.break_required_after_driving_hours + EPS, (
                f"drove without a 30-minute break at {event.start}"
            )
            non_driving_streak = 0.0
            driving_since_reset += hours
            driving_since_break += hours
            cycle_used += hours
            miles_since_fuel += event.distance_miles

            assert driving_since_reset <= rules.max_driving_hours + EPS, (
                f"11-hour driving limit exceeded at {event.end}"
            )
            assert hours_between(window_start, event.end) <= rules.max_duty_window_hours + EPS, (
                f"drove past the 14-hour window at {event.end}"
            )
            assert driving_since_break <= rules.break_required_after_driving_hours + EPS, (
                f"more than 8 hours driving without a break at {event.end}"
            )
            assert cycle_used <= rules.cycle_limit_hours + EPS, (
                f"70-hour cycle exceeded at {event.end}"
            )
            assert miles_since_fuel <= rules.fuel_interval_miles + 1e-6, (
                f"fuel interval exceeded at {event.end}"
            )
        else:  # on duty, not driving
            assert event.distance_miles == pytest.approx(0.0)
            non_driving_streak += hours
            cycle_used += hours
            assert cycle_used <= rules.cycle_limit_hours + EPS
            if non_driving_streak + EPS >= rules.min_break_hours:
                driving_since_break = 0.0
            if event.event_type is EventType.FUEL:
                miles_since_fuel = 0.0


def events_of(schedule, event_type):
    return [e for e in schedule.events if e.event_type is event_type]


# --------------------------------------------------------------------------- #
# Basic structure
# --------------------------------------------------------------------------- #


class TestBasicStructure:
    def test_short_trip_fits_in_one_day_without_stops(self):
        request = make_request(100, 200)  # 5 h driving + 2 h tasks
        schedule = HOSEngine().plan(request)

        assert_compliant(schedule)
        assert [e.event_type for e in schedule.events] == [
            EventType.DRIVE,
            EventType.PICKUP,
            EventType.DRIVE,
            EventType.DROPOFF,
        ]
        assert schedule.summary.driving_hours == pytest.approx(5.0)
        assert schedule.summary.on_duty_hours == pytest.approx(2.0)
        assert schedule.summary.total_miles == pytest.approx(300.0)
        assert schedule.end_time == START + timedelta(hours=7)

    def test_pickup_and_dropoff_take_one_hour_each_at_the_right_odometer(self):
        schedule = HOSEngine().plan(make_request(120, 240))

        (pickup,) = events_of(schedule, EventType.PICKUP)
        (dropoff,) = events_of(schedule, EventType.DROPOFF)
        assert pickup.status is DutyStatus.ON_DUTY
        assert pickup.duration_hours == pytest.approx(1.0)
        assert pickup.start_miles == pytest.approx(120.0)
        assert dropoff.duration_hours == pytest.approx(1.0)
        assert dropoff.start_miles == pytest.approx(360.0)
        assert schedule.events[-1] is dropoff

    def test_zero_distance_to_pickup_starts_with_loading(self):
        schedule = HOSEngine().plan(make_request(0, 300))

        assert_compliant(schedule)
        assert schedule.events[0].event_type is EventType.PICKUP
        assert schedule.events[0].start == START

    def test_leg_index_is_recorded_on_events(self):
        schedule = HOSEngine().plan(make_request(60, 60))
        assert [e.leg_index for e in schedule.events] == [0, 0, 1, 1]


# --------------------------------------------------------------------------- #
# 30-minute break rule
# --------------------------------------------------------------------------- #


class TestBreakRule:
    def test_break_inserted_after_eight_cumulative_driving_hours(self):
        # 50 mi to pickup (0.83 h), then 540 mi (9 h) -> break needed in leg 2.
        schedule = HOSEngine().plan(make_request(50, 540))

        assert_compliant(schedule)
        breaks = events_of(schedule, EventType.BREAK)
        assert len(breaks) == 1
        assert breaks[0].status is DutyStatus.OFF_DUTY
        assert breaks[0].duration_hours == pytest.approx(0.5)
        # Pickup resets the break clock, so the break lands 8 h into leg 2.
        pickup_end = events_of(schedule, EventType.PICKUP)[0].end
        assert breaks[0].start == pickup_end + timedelta(hours=8)

    def test_one_hour_pickup_counts_as_break(self):
        # 7.5 h to pickup, 1 h load, 3 h to drop-off: 10.5 h driving total but
        # never 8 h without a >=30 min non-driving interruption.
        schedule = HOSEngine().plan(make_request(450, 180))

        assert_compliant(schedule)
        assert events_of(schedule, EventType.BREAK) == []
        assert events_of(schedule, EventType.REST) == []

    def test_break_skipped_when_rest_is_imminent(self):
        # With a shortened 8.6-hour window the break would leave only 6 min
        # of drivable time, so the planner goes straight to the 10-hour rest.
        rules = HOSRules(max_duty_window_hours=8.6)
        schedule = HOSEngine(rules).plan(make_request(0, 900))

        assert_compliant(schedule, rules)
        assert events_of(schedule, EventType.BREAK) == []
        assert len(events_of(schedule, EventType.REST)) >= 1


# --------------------------------------------------------------------------- #
# 11-hour / 14-hour daily limits
# --------------------------------------------------------------------------- #


class TestDailyLimits:
    def test_long_trip_splits_across_days_with_ten_hour_rest(self):
        # ~980 miles: 16.3 h of driving -> cannot fit in one 11-hour day.
        schedule = HOSEngine().plan(make_request(30, 950))

        assert_compliant(schedule)
        rests = events_of(schedule, EventType.REST)
        assert len(rests) == 1
        assert rests[0].status is DutyStatus.SLEEPER_BERTH
        assert rests[0].duration_hours == pytest.approx(10.0)

        # Exactly 11 h driven before the rest.
        driven_before_rest = sum(
            e.duration_hours
            for e in schedule.events
            if e.status is DutyStatus.DRIVING and e.end <= rests[0].start
        )
        assert driven_before_rest == pytest.approx(11.0)
        assert schedule.end_time.date() > START.date()

    def test_fourteen_hour_window_binds_before_driving_limit(self):
        # Make the driving limit irrelevant so the 14-hour window must bind.
        rules = HOSRules(max_driving_hours=24.0, break_required_after_driving_hours=24.0)
        schedule = HOSEngine(rules).plan(make_request(60, 1500))

        assert_compliant(schedule, rules)
        rests = events_of(schedule, EventType.REST)
        assert rests
        first_rest = rests[0]
        # From 06:00 start, driving must stop by 20:00 -> rest starts then.
        assert first_rest.start == START + timedelta(hours=14)

    def test_dropoff_fits_when_window_has_room(self):
        # 1 h drive + 1 h pickup + 8 h drive + 0.5 h break + 2 h drive = 12.5 h
        # -> 1.5 h of window left on arrival, so the 1 h drop-off happens now.
        schedule = HOSEngine().plan(make_request(60, 600))

        assert_compliant(schedule)
        dropoff = events_of(schedule, EventType.DROPOFF)[0]
        previous = schedule.events[schedule.events.index(dropoff) - 1]
        assert previous.event_type is EventType.DRIVE
        assert dropoff.start == START + timedelta(hours=12.5)

    def test_dropoff_waits_for_rest_when_window_nearly_closed(self):
        # Allow 13 driving hours so arrival lands 13.7 h into the window:
        # 1 h + 1 h pickup + 8 h + 0.5 h break + 3.2 h.  Only 0.3 h remain,
        # the 1 h drop-off does not fit, so the planner rests first.
        rules = HOSRules(max_driving_hours=13.0)
        schedule = HOSEngine(rules).plan(make_request(60, 672))

        assert_compliant(schedule, rules)
        dropoff = events_of(schedule, EventType.DROPOFF)[0]
        previous = schedule.events[schedule.events.index(dropoff) - 1]
        assert previous.event_type is EventType.REST
        assert previous.start == START + timedelta(hours=13.7)


# --------------------------------------------------------------------------- #
# Fuel stops
# --------------------------------------------------------------------------- #


class TestFuelStops:
    def test_fuel_stop_every_thousand_miles(self):
        schedule = HOSEngine().plan(make_request(100, 2400))  # 2500 miles total

        assert_compliant(schedule)
        fuel_stops = events_of(schedule, EventType.FUEL)
        assert len(fuel_stops) == 2
        assert all(f.status is DutyStatus.ON_DUTY for f in fuel_stops)
        assert fuel_stops[0].start_miles == pytest.approx(1000.0)
        assert fuel_stops[1].start_miles == pytest.approx(2000.0)

    def test_no_fuel_stop_under_thousand_miles(self):
        schedule = HOSEngine().plan(make_request(100, 850))
        assert_compliant(schedule)
        assert events_of(schedule, EventType.FUEL) == []

    def test_fuel_stop_counts_as_break(self):
        # Fuel is due after 1000 mi = 16.7 h at 60 mph; drop speed so fuel
        # comes up before 8 driving hours: 1000 mi at 150 mph = 6.67 h.
        schedule = HOSEngine().plan(make_request(0, 1800, speed_mph=150))

        assert_compliant(schedule)
        fuel = events_of(schedule, EventType.FUEL)[0]
        # After fuelling at 6.67 h the break clock restarts, so the next stop
        # is another 8 h of driving away - not a break 1.33 h later.
        following = [e for e in schedule.events if e.start >= fuel.end and e.is_stop]
        assert following[0].event_type is not EventType.BREAK


# --------------------------------------------------------------------------- #
# 70-hour / 8-day cycle
# --------------------------------------------------------------------------- #


class TestCycleLimit:
    def test_restart_inserted_when_cycle_would_be_exceeded(self):
        # 65 h used; trip needs ~16 h driving + 2 h tasks = 18 h on duty.
        schedule = HOSEngine().plan(make_request(30, 950, cycle_used=65))

        assert_compliant(schedule, initial_cycle_used=65)
        restarts = events_of(schedule, EventType.RESTART)
        assert len(restarts) == 1
        assert restarts[0].status is DutyStatus.OFF_DUTY
        assert restarts[0].duration_hours == pytest.approx(34.0)

        on_duty_before_restart = sum(
            e.duration_hours
            for e in schedule.events
            if e.status in (DutyStatus.DRIVING, DutyStatus.ON_DUTY) and e.end <= restarts[0].start
        )
        assert 65 + on_duty_before_restart <= 70 + EPS
        assert schedule.summary.cycle_used_at_start == 65
        assert schedule.summary.cycle_used_at_end < 70

    def test_full_cycle_forces_restart_before_any_driving(self):
        schedule = HOSEngine().plan(make_request(100, 100, cycle_used=70))

        assert_compliant(schedule, initial_cycle_used=70)
        assert schedule.events[0].event_type is EventType.RESTART
        assert schedule.events[1].event_type is EventType.DRIVE

    def test_cycle_hours_include_on_duty_not_driving(self):
        # 69.5 h used: only 30 min of on-duty time remains, so the first
        # 1-hour pickup cannot happen until after a restart.
        schedule = HOSEngine().plan(make_request(0, 60, cycle_used=69.5))

        assert_compliant(schedule, initial_cycle_used=69.5)
        assert schedule.events[0].event_type is EventType.RESTART
        assert schedule.events[1].event_type is EventType.PICKUP


# --------------------------------------------------------------------------- #
# Realistic end-to-end trips
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    "to_pickup, to_dropoff, cycle_used, speed",
    [
        (15, 280, 0, 55),  # local day trip
        (30, 950, 0, 58),  # Chicago -> Dallas-ish, 2 days
        (200, 2800, 0, 60),  # coast to coast
        (200, 2800, 50, 60),  # coast to coast with a tired driver
        (500, 500, 68, 62),  # cycle nearly used up
        (0, 4000, 10, 60),  # very long haul
        (35, 1210, 20, 45),  # slow roads
    ],
)
def test_sample_trips_are_compliant(to_pickup, to_dropoff, cycle_used, speed):
    request = make_request(to_pickup, to_dropoff, cycle_used=cycle_used, speed_mph=speed)
    schedule = HOSEngine().plan(request)

    assert_compliant(schedule, initial_cycle_used=cycle_used)
    assert schedule.summary.total_miles == pytest.approx(to_pickup + to_dropoff)
    assert schedule.summary.driving_hours == pytest.approx((to_pickup + to_dropoff) / speed)
    assert len(events_of(schedule, EventType.PICKUP)) == 1
    assert len(events_of(schedule, EventType.DROPOFF)) == 1
    expected_fuel_stops = int((to_pickup + to_dropoff - 1e-9) // DEFAULT_RULES.fuel_interval_miles)
    assert len(events_of(schedule, EventType.FUEL)) == expected_fuel_stops


# --------------------------------------------------------------------------- #
# Validation
# --------------------------------------------------------------------------- #


class TestValidation:
    def test_cycle_used_above_limit_rejected(self):
        with pytest.raises(HOSPlanningError):
            HOSEngine().plan(make_request(10, 10, cycle_used=71))

    def test_negative_distance_rejected(self):
        with pytest.raises(HOSPlanningError):
            HOSEngine().plan(make_request(-5, 10))

    def test_missing_legs_rejected(self):
        with pytest.raises(HOSPlanningError):
            HOSEngine().plan(TripPlanRequest(START, 0, []))

    def test_zero_duration_with_distance_rejected(self):
        legs = [Leg("to_pickup", 10, 0), Leg("to_dropoff", 10, 1)]
        with pytest.raises(HOSPlanningError):
            HOSEngine().plan(TripPlanRequest(START, 0, legs))


# --------------------------------------------------------------------------- #
# Daily log sheets
# --------------------------------------------------------------------------- #


class TestDailyLogs:
    @pytest.fixture
    def multi_day(self):
        schedule = HOSEngine().plan(make_request(200, 2800, cycle_used=50))
        return schedule, build_daily_logs(schedule)

    def test_one_sheet_per_calendar_day(self, multi_day):
        schedule, logs = multi_day
        expected_days = (schedule.end_time.date() - schedule.start_time.date()).days + 1
        assert len(logs) == expected_days
        assert [log.day_number for log in logs] == list(range(1, expected_days + 1))
        assert logs[0].date == START.date()

    def test_each_sheet_covers_exactly_24_hours(self, multi_day):
        _, logs = multi_day
        for log in logs:
            assert sum(log.totals.values()) == pytest.approx(24.0)
            assert log.entries[0].start_minute == 0
            assert log.entries[-1].end_minute == 24 * 60
            for previous, current in zip(log.entries, log.entries[1:]):
                assert current.start == previous.end

    def test_first_and_last_sheets_are_padded_with_off_duty(self, multi_day):
        schedule, logs = multi_day
        first, last = logs[0], logs[-1]
        assert first.entries[0].event_type is EventType.PRE_TRIP
        assert first.entries[0].end == schedule.start_time
        assert last.entries[-1].event_type is EventType.POST_TRIP
        assert last.entries[-1].start == schedule.end_time

    def test_total_miles_preserved_across_sheets(self, multi_day):
        schedule, logs = multi_day
        assert sum(log.miles_driven for log in logs) == pytest.approx(schedule.summary.total_miles)

    def test_miles_are_split_proportionally_across_midnight(self):
        # Start 23:00, 2 h drive to pickup: 1 h (60 mi) tonight, 1 h tomorrow.
        schedule = HOSEngine().plan(make_request(120, 60, start=datetime(2026, 9, 21, 23, 0)))
        logs = build_daily_logs(schedule)

        assert len(logs) == 2
        assert logs[0].miles_driven == pytest.approx(60.0)
        assert logs[1].miles_driven == pytest.approx(120.0)
        crossing = logs[0].entries[-1]
        assert crossing.status is DutyStatus.DRIVING
        assert crossing.end_minute == 24 * 60
        assert crossing.end_miles == pytest.approx(60.0)
        assert logs[1].entries[0].start_minute == 0
        assert logs[1].entries[0].start_miles == pytest.approx(60.0)

    def test_single_day_trip_produces_one_sheet(self):
        schedule = HOSEngine().plan(make_request(100, 200))
        logs = build_daily_logs(schedule)
        assert len(logs) == 1
        log = logs[0]
        assert log.totals["driving"] == pytest.approx(5.0)
        assert log.totals["on_duty"] == pytest.approx(2.0)
        assert log.totals["off_duty"] == pytest.approx(17.0)
        assert log.miles_driven == pytest.approx(300.0)

    def test_trip_ending_exactly_at_midnight_has_no_empty_sheet(self):
        # 06:00 start, 18 h total -> ends 00:00 next day.  Build a schedule
        # whose events end exactly on midnight: 16 h driving is not legal in
        # one day, so use custom rules that allow it.
        rules = HOSRules(max_driving_hours=24, max_duty_window_hours=24,
                         break_required_after_driving_hours=24)
        schedule = HOSEngine(rules).plan(make_request(60, 900))  # 1 + 15 h drive + 2 h tasks
        assert schedule.end_time == datetime(2026, 9, 22, 0, 0)
        logs = build_daily_logs(schedule)
        assert len(logs) == 1
        assert logs[0].entries[-1].end_minute == 24 * 60
