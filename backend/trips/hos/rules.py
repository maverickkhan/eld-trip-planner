"""
Hours-of-Service rule parameters for property-carrying drivers (49 CFR 395.3)
plus the assessment-specific operational assumptions (fuel interval, dwell
times).  Everything is a plain dataclass so tests can construct variants.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class HOSRules:
    # 395.3(a)(3)(i): no driving after 11 cumulative hours following 10h off.
    max_driving_hours: float = 11.0
    # 395.3(a)(2): no driving beyond the 14th consecutive hour after coming on duty.
    max_duty_window_hours: float = 14.0
    # 395.3(a)(3)(ii): 30-minute interruption required after 8 cumulative driving hours.
    break_required_after_driving_hours: float = 8.0
    min_break_hours: float = 0.5
    # 395.3(a)(1): 10 consecutive hours off duty resets the daily limits.
    min_off_duty_reset_hours: float = 10.0
    # 395.3(b)(2): 70 hours on duty in any 8 consecutive days.
    cycle_limit_hours: float = 70.0
    cycle_days: int = 8
    # 395.3(c): 34 consecutive hours off duty restarts the 7/8-day period.
    cycle_restart_hours: float = 34.0

    # --- Assessment-specific operational assumptions ---
    fuel_interval_miles: float = 1000.0
    fuel_stop_hours: float = 0.5
    pickup_hours: float = 1.0
    dropoff_hours: float = 1.0

    # Planning heuristic: if, after a 30-minute break, fewer than this many
    # driving hours would remain before a 10-hour reset is needed anyway,
    # skip the break and go straight to the reset.
    min_useful_driving_hours: float = 0.25

    # Planning heuristic: when a 10-hour rest is due but fewer than this many
    # cycle hours remain and the rest of the trip cannot fit in them anyway,
    # take the 34-hour restart now instead of rest -> sliver of work -> restart
    # (the restart also satisfies the rest, so this is never slower).
    restart_instead_of_rest_below_cycle_hours: float = 2.0


DEFAULT_RULES = HOSRules()
