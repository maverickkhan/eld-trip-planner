"""
Assessment-requirement tests: one explicit, forcing scenario per HOS rule,
the input-space edge cases, and cross-view data consistency.

Every schedule is also replayed through ``assert_compliant`` (an independent
re-implementation of the limits) so a passing scenario proves both that the
rule *triggered* and that nothing else was violated while it did.
"""

from datetime import datetime, timedelta

import pytest
from rest_framework.test import APIClient

from trips.hos import DutyStatus, EventType, HOSEngine, HOSPlanningError, HOSRules, Leg, TripPlanRequest, build_daily_logs
from trips.tests.test_api import PAYLOAD, FakeGeocoder, FakeRouter
from trips.tests.test_hos_engine import START, assert_compliant, events_of, hours_between, make_request

EPS = 1e-6
ON_DUTY = (DutyStatus.DRIVING, DutyStatus.ON_DUTY)


def plan(request, rules=None):
    engine = HOSEngine(rules) if rules else HOSEngine()
    return engine.plan(request)


def driving_hours(events, start=None, end=None):
    return sum(
        e.duration_hours
        for e in events
        if e.status is DutyStatus.DRIVING
        and (start is None or e.start >= start)
        and (end is None or e.end <= end)
    )


def on_duty_hours(events, start=None, end=None):
    return sum(
        e.duration_hours
        for e in events
        if e.status in ON_DUTY and (start is None or e.start >= start) and (end is None or e.end <= end)
    )


def duty_periods(schedule):
    """Split events into duty periods separated by >=10 h off duty (rest/restart)."""
    periods, current = [], []
    for event in schedule.events:
        if event.event_type in (EventType.REST, EventType.RESTART):
            if current:
                periods.append(current)
            current = []
        else:
            current.append(event)
    if current:
        periods.append(current)
    return periods


# --------------------------------------------------------------------------- #
# 1. HOS rule coverage
# --------------------------------------------------------------------------- #


class TestRule11HourDrivingLimit:
    def test_single_duty_period_stops_at_exactly_11_hours_of_driving(self):
        # Pickup at the very start, then 1,500 mi (25 h) of driving.
        schedule = plan(make_request(0, 1500))
        assert_compliant(schedule)

        first_rest = events_of(schedule, EventType.REST)[0]
        driven = driving_hours(schedule.events, end=first_rest.start)
        assert driven == pytest.approx(11.0), f"drove {driven:.2f} h before first rest"
        # The rest is triggered by driving, i.e. the last thing before it is a drive segment.
        before = schedule.events[schedule.events.index(first_rest) - 1]
        assert before.event_type is EventType.DRIVE
        # Every full duty period on this trip also stops at exactly 11 h driving.
        for period in duty_periods(schedule)[:-1]:
            assert sum(e.duration_hours for e in period if e.status is DutyStatus.DRIVING) == pytest.approx(11.0)


class TestRule14HourWindow:
    def test_window_binds_before_11h_driving_when_stops_are_frequent(self):
        # Fuel every 120 mi (= every 2 h at 60 mph, 30 min each) piles up
        # on-duty-not-driving time so the 14-hour window closes first
        # (1 h pickup + 5 fuel stops = 3.5 h non-driving -> 10.5 h driving max).
        rules = HOSRules(fuel_interval_miles=120)
        schedule = plan(make_request(60, 1500), rules)
        assert_compliant(schedule, rules)

        first_rest = events_of(schedule, EventType.REST)[0]
        elapsed = hours_between(schedule.start_time, first_rest.start)
        driven = driving_hours(schedule.events, end=first_rest.start)
        assert driven < 11.0 - EPS, "the 11-hour limit must not be the binding constraint here"
        assert 13.5 <= elapsed <= 14.0 + EPS, f"rest should start at hour 14, started at {elapsed:.2f}"

    def test_no_driving_ever_ends_after_the_14th_hour(self):
        rules = HOSRules(fuel_interval_miles=120)
        for request in (make_request(60, 1500), make_request(0, 4000, cycle_used=10)):
            schedule = plan(request, rules)
            for period in duty_periods(schedule):
                window_start = period[0].start
                for event in period:
                    if event.status is DutyStatus.DRIVING:
                        assert hours_between(window_start, event.end) <= 14.0 + EPS

    def test_with_assessment_dwell_times_the_11h_limit_binds_first(self):
        # Finding, not just a check: 1 h pickup + 0.5 h break + 0.5 h fuel leave
        # >= 1 h of slack in the 14-hour window, so the 11-hour rule always wins.
        # 3,400 mi -> ~60 h on duty, so the 70-h cycle never interferes.
        schedule = plan(make_request(200, 3200, cycle_used=0))
        assert_compliant(schedule)
        assert events_of(schedule, EventType.RESTART) == []
        for period in duty_periods(schedule)[:-1]:  # last period ends at drop-off
            assert sum(e.duration_hours for e in period if e.status is DutyStatus.DRIVING) == pytest.approx(11.0)


class TestRule30MinuteBreak:
    ISOLATED = HOSRules(max_driving_hours=30, max_duty_window_hours=40, fuel_interval_miles=10_000)

    def test_break_after_every_8_cumulative_driving_hours_and_counter_resets(self):
        schedule = plan(make_request(0, 1500), self.ISOLATED)  # pickup, then 25 h driving
        assert_compliant(schedule, self.ISOLATED)

        breaks = events_of(schedule, EventType.BREAK)
        assert len(breaks) == 3  # at 8, 16 and 24 h of driving
        boundaries = [schedule.start_time] + [b.end for b in breaks]
        for start, brk in zip(boundaries, breaks):
            assert driving_hours(schedule.events, start=start, end=brk.start) == pytest.approx(8.0)
            assert brk.duration_hours == pytest.approx(0.5)
            assert brk.status is DutyStatus.OFF_DUTY
        # After the last break only 1 h of driving remains -> no further break.
        assert driving_hours(schedule.events, start=breaks[-1].end) == pytest.approx(1.0)

    def test_on_duty_fuel_stop_satisfies_the_break(self):
        # Fuel every 300 mi (5 h) means the driver never reaches 8 h without a
        # >= 30-minute non-driving period -> zero dedicated breaks (2020 rule).
        rules = HOSRules(max_driving_hours=30, max_duty_window_hours=40, fuel_interval_miles=300)
        schedule = plan(make_request(0, 1500), rules)
        assert_compliant(schedule, rules)
        assert events_of(schedule, EventType.BREAK) == []
        fuel = events_of(schedule, EventType.FUEL)
        assert [f.start_miles for f in fuel] == [300, 600, 900, 1200]

    def test_one_hour_pickup_satisfies_the_break(self):
        schedule = plan(make_request(450, 180))  # 7.5 h drive, 1 h pickup, 3 h drive
        assert_compliant(schedule)
        assert events_of(schedule, EventType.BREAK) == []


class TestRule10HourReset:
    def test_every_rest_is_exactly_10_hours_and_driving_resumes_after(self):
        schedule = plan(make_request(200, 2800, cycle_used=50))
        assert_compliant(schedule, initial_cycle_used=50)
        rests = events_of(schedule, EventType.REST)
        assert len(rests) >= 3
        for rest in rests:
            assert rest.duration_hours == pytest.approx(10.0)
            assert rest.status is DutyStatus.SLEEPER_BERTH
            following = schedule.events[schedule.events.index(rest) + 1]
            assert following.event_type not in (EventType.REST, EventType.BREAK, EventType.RESTART)

    def test_rest_split_across_midnight_still_totals_10_hours_in_the_logs(self):
        schedule = plan(make_request(30, 950))  # rest 18:30 -> 04:30 next day
        rest = events_of(schedule, EventType.REST)[0]
        assert rest.start.date() != rest.end.date()

        logs = build_daily_logs(schedule)
        parts = [
            e for log in logs for e in log.entries
            if e.event_type is EventType.REST and rest.start <= e.start < rest.end
        ]
        assert len(parts) == 2
        assert sum(p.duration_hours for p in parts) == pytest.approx(10.0)
        assert logs[0].totals["sleeper_berth"] + logs[1].totals["sleeper_berth"] == pytest.approx(10.0)


class TestRule34HourRestart:
    def test_restart_only_when_cycle_is_exhausted_and_resets_to_zero(self):
        schedule = plan(make_request(30, 950, cycle_used=65))
        assert_compliant(schedule, initial_cycle_used=65)

        (restart,) = events_of(schedule, EventType.RESTART)
        assert restart.duration_hours == pytest.approx(34.0)
        assert restart.status is DutyStatus.OFF_DUTY
        # Fires only once the next task can no longer fit under 70 h.
        assert 69.0 <= restart.cycle_used_before <= 70.0 + EPS
        assert restart.cycle_used_after == 0.0
        # After the restart the cycle counts only the trip's remaining on-duty time.
        assert schedule.summary.cycle_used_at_end == pytest.approx(on_duty_hours(schedule.events, start=restart.end))

    def test_restart_taken_directly_instead_of_rest_then_sliver_then_restart(self):
        # 57.7 h used: after 11 h driving + 1 h pickup only 0.3 h of cycle
        # remain and 1,500 more miles are needed, so a restart is inevitable.
        # A 10-h rest followed by 0.3 h of work and then the 34-h restart
        # would waste 10 h; the planner must go straight to the restart.
        schedule = plan(make_request(0, 1500, cycle_used=57.7))
        assert_compliant(schedule, initial_cycle_used=57.7)
        types = [e.event_type for e in schedule.events]
        for previous, current in zip(types, types[1:]):
            assert not (previous is EventType.REST and current is EventType.RESTART)
        first_restart = events_of(schedule, EventType.RESTART)[0]
        before = schedule.events[schedule.events.index(first_restart) - 1]
        assert before.event_type is EventType.DRIVE
        assert events_of(schedule, EventType.REST)[0].start > first_restart.end

    def test_early_restart_only_when_the_remaining_cycle_cannot_finish_the_trip(self):
        # 700 mi: 11 h driving + 1 h pickup, then 40 mi (0.67 h) + 1 h drop-off = 1.67 h left.
        # 56 h used -> 2.0 h of cycle left >= 1.67 h needed: a plain 10-h rest finishes the trip.
        with_room = plan(make_request(0, 700, cycle_used=56))
        assert_compliant(with_room, initial_cycle_used=56)
        assert events_of(with_room, EventType.RESTART) == []
        assert len(events_of(with_room, EventType.REST)) == 1
        # 57 h used -> 1.0 h left < 1.67 h needed: the restart is inevitable, so it
        # is taken right away instead of rest -> 0.67 h drive -> restart.
        without_room = plan(make_request(0, 700, cycle_used=57))
        assert_compliant(without_room, initial_cycle_used=57)
        assert events_of(without_room, EventType.REST) == []
        (restart,) = events_of(without_room, EventType.RESTART)
        assert without_room.events[without_room.events.index(restart) - 1].event_type is EventType.DRIVE

    def test_no_restart_when_the_cycle_has_room(self):
        schedule = plan(make_request(200, 2800, cycle_used=0))  # ~52 h on duty < 70
        assert_compliant(schedule)
        assert events_of(schedule, EventType.RESTART) == []
        assert schedule.summary.cycle_used_at_end == pytest.approx(on_duty_hours(schedule.events))


class TestRule70HourCycle:
    @pytest.mark.parametrize("used", [65, 67, 69])
    def test_starting_near_the_cap_forces_a_restart_almost_immediately(self, used):
        schedule = plan(make_request(30, 950, cycle_used=used))
        assert_compliant(schedule, initial_cycle_used=used)

        restart = events_of(schedule, EventType.RESTART)[0]
        worked = on_duty_hours(schedule.events, end=restart.start)
        assert used + worked <= 70.0 + EPS
        # Nothing but work happens before the restart, so it starts within (70 - used) hours.
        assert hours_between(schedule.start_time, restart.start) <= (70 - used) + EPS

    def test_starting_at_zero_never_restarts_unnecessarily(self):
        for request in (make_request(15, 280), make_request(30, 950), make_request(200, 2800)):
            schedule = plan(request)
            assert events_of(schedule, EventType.RESTART) == []


class TestRuleFuelEvery1000Miles:
    def test_three_fuel_stops_land_exactly_on_the_thousand_mile_marks(self):
        schedule = plan(make_request(100, 3400))  # 3,500 mi
        assert_compliant(schedule)
        fuel = events_of(schedule, EventType.FUEL)
        assert [round(f.start_miles, 3) for f in fuel] == [1000.0, 2000.0, 3000.0]
        assert all(f.duration_hours == pytest.approx(0.5) and f.status is DutyStatus.ON_DUTY for f in fuel)

    def test_no_early_fuel_stops(self):
        schedule = plan(make_request(100, 850))  # 950 mi -> none
        assert events_of(schedule, EventType.FUEL) == []

    def test_at_least_once_every_1000_miles_is_respected_at_the_boundary(self):
        # Just over 1,000 mi -> exactly one stop, at mile 1,000 (not skipped, not early).
        schedule = plan(make_request(300, 700.5))
        fuel = events_of(schedule, EventType.FUEL)
        assert len(fuel) == 1
        assert fuel[0].start_miles == pytest.approx(1000.0, abs=1e-3)
        # Exactly 1,000 mi: you arrive on the first tank, no stop needed.
        assert events_of(plan(make_request(300, 700)), EventType.FUEL) == []

    @pytest.mark.parametrize("speed", [47.3, 52.9, 58.1, 61.7])
    def test_gap_between_fills_never_exceeds_1000_miles_despite_float_rounding(self, speed):
        schedule = plan(make_request(137.3, 3472.9, speed_mph=speed))
        assert_compliant(schedule)
        last_fill = 0.0
        for event in schedule.events:
            if event.status is DutyStatus.DRIVING:
                assert event.end_miles - last_fill <= 1000.0 + 1e-3
            if event.event_type is EventType.FUEL:
                assert event.start_miles - last_fill == pytest.approx(1000.0, abs=1e-3)
                last_fill = event.start_miles


class TestRulePickupAndDropoff:
    @pytest.mark.parametrize("to_pickup, to_dropoff", [(5, 8), (100, 200), (200, 2800), (0, 4000)])
    def test_always_exactly_one_hour_on_duty_not_driving(self, to_pickup, to_dropoff):
        schedule = plan(make_request(to_pickup, to_dropoff))
        (pickup,) = events_of(schedule, EventType.PICKUP)
        (dropoff,) = events_of(schedule, EventType.DROPOFF)
        for task in (pickup, dropoff):
            assert task.duration_hours == pytest.approx(1.0)
            assert task.status is DutyStatus.ON_DUTY
        assert schedule.events[-1] is dropoff

    def test_pickup_arriving_exactly_at_the_8h_break_boundary(self):
        # 480 mi at 60 mph = 8.0 h driving on arrival: the 1 h pickup itself
        # satisfies the 30-minute break; no separate break, pickup still 1 h.
        schedule = plan(make_request(480, 300))
        assert_compliant(schedule)
        drive, pickup = schedule.events[0], schedule.events[1]
        assert drive.duration_hours == pytest.approx(8.0)
        assert pickup.event_type is EventType.PICKUP and pickup.duration_hours == pytest.approx(1.0)
        assert events_of(schedule, EventType.BREAK) == []

    def test_pickup_arriving_exactly_at_the_11h_driving_limit(self):
        # 660 mi = 11.0 h driving on arrival (with the 30-min break at 8 h).
        # Loading is not driving and fits the 14-h window, so it happens
        # immediately (1 h) at the driving limit, then the 10-h rest.
        schedule = plan(make_request(660, 300))
        assert_compliant(schedule)
        types = [e.event_type for e in schedule.events[:6]]
        assert types == [
            EventType.DRIVE, EventType.BREAK, EventType.DRIVE, EventType.PICKUP, EventType.REST, EventType.DRIVE,
        ]
        pickup = schedule.events[3]
        assert pickup.duration_hours == pytest.approx(1.0)
        assert driving_hours(schedule.events, end=pickup.start) == pytest.approx(11.0)

    def test_dropoff_arriving_with_less_than_an_hour_of_window_left_waits_for_rest_but_stays_1h(self):
        rules = HOSRules(max_driving_hours=13.0)
        schedule = plan(make_request(60, 672), rules)  # arrives 13.7 h into the window
        assert_compliant(schedule, rules)
        dropoff = events_of(schedule, EventType.DROPOFF)[0]
        assert dropoff.duration_hours == pytest.approx(1.0)
        assert schedule.events[schedule.events.index(dropoff) - 1].event_type is EventType.REST


class TestRolling8DayCycleWindow:
    """The 70-hour cycle counts on-duty time in the trailing 8 calendar days."""

    @staticmethod
    def _on_duty_by_day(events):
        """Independent re-implementation: on-duty hours per calendar day, split at midnight."""
        from collections import defaultdict
        from datetime import time

        buckets = defaultdict(float)
        for event in events:
            if event.status not in ON_DUTY:
                continue
            cursor = event.start
            while cursor < event.end:
                next_midnight = datetime.combine(cursor.date() + timedelta(days=1), time.min)
                segment_end = min(event.end, next_midnight)
                buckets[cursor.date()] += hours_between(cursor, segment_end)
                cursor = segment_end
        return buckets

    def test_cycle_after_each_event_is_the_trailing_8_day_sum_since_the_last_restart(self):
        schedule = plan(make_request(100, 8900, cycle_used=0))  # 9,000 mi, ~14 calendar days
        events = schedule.events
        assert len(events_of(schedule, EventType.RESTART)) >= 2

        cycle_start_index = 0  # first event of the current cycle (after the last restart)
        for index, event in enumerate(events):
            if event.event_type is EventType.RESTART:
                assert event.cycle_used_after == 0.0
                cycle_start_index = index + 1
                continue
            if event.status not in ON_DUTY:
                continue
            buckets = self._on_duty_by_day(events[cycle_start_index : index + 1])
            window_start = event.end.date() - timedelta(days=7)
            expected = sum(hours for day, hours in buckets.items() if day >= window_start)
            assert event.cycle_used_after == pytest.approx(expected, abs=1e-6), f"event {index} {event.event_type}"

        # Never drives past 70 hours within the window.
        for event in events:
            if event.status is DutyStatus.DRIVING:
                assert event.cycle_used_after <= 70.0 + EPS

    def test_finding_hours_never_age_out_in_practice(self):
        # The planner drives ~11 h + stops per day, so 70 h is exhausted (and a
        # restart taken) within 6-7 days: no trip ever spans 8 days of the
        # same cycle, so the rolling drop-off is a safety net, not a live path.
        schedule = plan(make_request(100, 8900, cycle_used=0))
        for period_start, period_end in self._cycle_periods(schedule):
            assert (period_end.date() - period_start.date()).days < 8

    @staticmethod
    def _cycle_periods(schedule):
        start = schedule.start_time
        for event in schedule.events:
            if event.event_type is EventType.RESTART:
                yield start, event.start
                start = event.end
        yield start, schedule.end_time


# --------------------------------------------------------------------------- #
# 2. Input-space edge cases
# --------------------------------------------------------------------------- #


class TestEdgeCases:
    def test_fresh_driver_cycle_zero(self):
        schedule = plan(make_request(100, 200, cycle_used=0))
        assert schedule.events[0].event_type is EventType.DRIVE
        assert schedule.summary.cycle_used_at_start == 0
        assert schedule.summary.cycle_used_at_end == pytest.approx(7.0)

    def test_cycle_at_the_cap_restarts_before_any_driving(self):
        schedule = plan(make_request(100, 200, cycle_used=70))
        assert schedule.events[0].event_type is EventType.RESTART
        assert schedule.events[0].duration_hours == pytest.approx(34.0)
        assert schedule.events[1].event_type is EventType.DRIVE

    @pytest.mark.parametrize("used", [70.01, 71, 100, -1])
    def test_cycle_outside_0_to_70_is_rejected_not_clamped(self, used):
        with pytest.raises(HOSPlanningError):
            plan(make_request(100, 200, cycle_used=used))

    def test_very_short_trip_has_no_stops(self):
        schedule = plan(make_request(3, 5))
        assert [e.event_type for e in schedule.events] == [
            EventType.DRIVE, EventType.PICKUP, EventType.DRIVE, EventType.DROPOFF,
        ]
        assert schedule.summary.total_hours == pytest.approx(2 + 8 / 60)
        assert len(build_daily_logs(schedule)) == 1

    def test_all_three_locations_identical(self):
        legs = [Leg("to_pickup", 0.0, 0.0), Leg("to_dropoff", 0.0, 0.0)]
        schedule = plan(TripPlanRequest(START, 0, legs))
        assert [e.event_type for e in schedule.events] == [EventType.PICKUP, EventType.DROPOFF]
        logs = build_daily_logs(schedule)
        assert len(logs) == 1
        assert sum(logs[0].totals.values()) == pytest.approx(24.0)
        assert logs[0].miles_driven == 0

    def test_restart_only_day_produces_a_complete_all_off_duty_sheet(self):
        # Mirrors the live LA -> Phoenix -> NYC trip with 60 h used: the
        # 34-hour restart covers the whole of day 2.
        schedule = plan(make_request(372.6, 2411.2, cycle_used=60, start=datetime(2026, 9, 21, 8, 0)))
        logs = build_daily_logs(schedule)

        off_days = [log for log in logs if log.totals["off_duty"] == pytest.approx(24.0)]
        assert len(off_days) == 1
        day = off_days[0]
        assert len(day.entries) == 1
        assert day.entries[0].event_type is EventType.RESTART
        assert day.entries[0].start_minute == 0 and day.entries[0].end_minute == 1440
        assert day.miles_driven == 0
        assert day.on_duty_hours_today == 0
        # Restart not yet complete at midnight -> cycle still shows the exhausted 70 h.
        assert day.cycle_used_at_end_of_day == pytest.approx(70.0)
        assert day.hours_available_tomorrow == 0
        # Following day: restart completes, cycle restarts from zero.
        following = logs[logs.index(day) + 1]
        assert following.cycle_used_at_end_of_day == pytest.approx(following.on_duty_hours_today)


# --------------------------------------------------------------------------- #
# 3. Cross-view data consistency (through the real API + presenter)
# --------------------------------------------------------------------------- #


LONG_PAYLOAD = {**PAYLOAD, "current_cycle_used_hours": 60, "start_time": "2026-09-21T08:00"}
LONG_ROUTER = dict(to_pickup=(372.6, 6.7), to_dropoff=(2411.2, 44.28))  # LA -> Phoenix -> NYC


@pytest.fixture
def long_plan():
    from unittest import mock

    with (
        mock.patch("trips.services.planner.NominatimGeocoder", return_value=FakeGeocoder()),
        mock.patch("trips.services.planner.OSRMRouter", return_value=FakeRouter(**LONG_ROUTER)),
    ):
        response = APIClient().post("/api/trips/", LONG_PAYLOAD, format="json")
    assert response.status_code == 201, response.content
    return response.json()


@pytest.mark.django_db
class TestCrossViewConsistency:
    def test_total_distance_agrees_everywhere(self, long_plan):
        summary = long_plan["schedule"]["summary"]
        events = long_plan["schedule"]["events"]
        logs = long_plan["daily_logs"]

        from_events = sum(e["distance_miles"] for e in events)
        final_odometer_schedule = events[-1]["end_miles"]
        final_odometer_logs = logs[-1]["entries"][-1]["end_miles"]
        from_log_days = sum(log["miles_driven"] for log in logs)

        assert summary["total_miles"] == pytest.approx(2783.8, abs=0.05)
        assert from_events == pytest.approx(summary["total_miles"], abs=0.5)  # per-row rounding
        assert final_odometer_schedule == pytest.approx(summary["total_miles"], abs=0.05)
        assert final_odometer_logs == pytest.approx(summary["total_miles"], abs=0.05)
        assert from_log_days == pytest.approx(summary["total_miles"], abs=0.5)

    def test_day_counts_agree(self, long_plan):
        logs = long_plan["daily_logs"]
        distinct_dates = {log["date"] for log in logs}
        event_dates = {e["start"][:10] for e in long_plan["schedule"]["events"]} | {
            e["end"][:10] for e in long_plan["schedule"]["events"] if e["end"][11:] != "00:00"
        }
        assert long_plan["schedule"]["summary"]["total_days"] == len(logs) == len(distinct_dates) == 6
        assert event_dates <= distinct_dates

    def test_cycle_used_at_end_matches_on_duty_after_last_restart(self, long_plan):
        events = long_plan["schedule"]["events"]
        summary = long_plan["schedule"]["summary"]
        restarts = [i for i, e in enumerate(events) if e["type"] == "restart"]
        assert restarts, "scenario should include a 34-hour restart"
        after = events[restarts[-1] + 1 :]
        expected = sum(e["duration_hours"] for e in after if e["status"] in ("driving", "on_duty"))
        assert summary["cycle_used_at_end"] == pytest.approx(expected, abs=0.05)
        assert long_plan["daily_logs"][-1]["recap"]["cycle_used_at_end_of_day"] == pytest.approx(
            summary["cycle_used_at_end"], abs=0.02
        )

    def test_each_sheet_totals_24h_and_recap_matches_totals(self, long_plan):
        for log in long_plan["daily_logs"]:
            assert sum(log["totals"].values()) == pytest.approx(24.0, abs=0.05)
            assert log["recap"]["on_duty_hours_today"] == pytest.approx(
                log["totals"]["driving"] + log["totals"]["on_duty"], abs=0.02
            )
            assert log["recap"]["hours_available_tomorrow"] == pytest.approx(
                max(0.0, 70 - log["recap"]["cycle_used_at_end_of_day"]), abs=0.02
            )

    def test_status_and_type_columns_are_consistent(self, long_plan):
        expected_status = {
            "drive": "driving",
            "pickup": "on_duty",
            "dropoff": "on_duty",
            "fuel": "on_duty",
            "break": "off_duty",
            "rest": "sleeper_berth",
            "restart": "off_duty",
            "pre_trip": "off_duty",
            "post_trip": "off_duty",
        }
        rows = [e for log in long_plan["daily_logs"] for e in log["entries"]] + long_plan["schedule"]["events"]
        for row in rows:
            assert row["status"] == expected_status[row["type"]], row
