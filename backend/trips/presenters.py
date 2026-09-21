"""
Convert engine/service dataclasses into the JSON structure the API returns.

Kept separate from DRF serializers (which validate *input*) so the output
shape is defined in one plain-Python place and is easy to snapshot-test.
"""

from __future__ import annotations

import math
from datetime import datetime

from .hos import DEFAULT_RULES, DailyLog, DutyEvent, EventType, LogEntry, Schedule
from .services.geocoding import GeocodedLocation
from .services.geometry import RouteLocator
from .services.routing import RouteResult

MAX_GEOMETRY_POINTS = 4000
MINUTES_PER_DAY = 24 * 60


def minute_totals(totals: dict[str, float]) -> dict[str, int]:
    """Whole-minute totals per status that always sum to exactly 24:00.

    Rounding each status independently can produce 23:59 or 24:01 on the
    printed sheet; largest-remainder allocation avoids that.
    """
    raw = {status: hours * 60.0 for status, hours in totals.items()}
    floors = {status: int(math.floor(value + 1e-9)) for status, value in raw.items()}
    remainder = MINUTES_PER_DAY - sum(floors.values())
    if remainder > 0:
        by_fraction = sorted(raw, key=lambda status: raw[status] - floors[status], reverse=True)
        for status in by_fraction[:remainder]:
            floors[status] += 1
    return floors


def _iso(value: datetime) -> str:
    return value.isoformat(timespec="minutes")


def _r(value: float, digits: int = 2) -> float:
    return round(value + 0.0, digits)


def _point(latlon: tuple[float, float] | None) -> dict | None:
    if latlon is None:
        return None
    return {"lat": _r(latlon[0], 6), "lon": _r(latlon[1], 6)}


def _downsample(coords: list[list[float]], limit: int = MAX_GEOMETRY_POINTS) -> list[list[float]]:
    if len(coords) <= limit:
        return coords
    step = len(coords) / (limit - 1)
    sampled = [coords[int(i * step)] for i in range(limit - 1)]
    sampled.append(coords[-1])
    return sampled


class PlanPresenter:
    def __init__(
        self,
        *,
        inputs: dict,
        locations: dict[str, GeocodedLocation],
        route: RouteResult,
        schedule: Schedule,
        daily_logs: list[DailyLog],
        locator: RouteLocator,
    ):
        self.inputs = inputs
        self.locations = locations
        self.route = route
        self.schedule = schedule
        self.daily_logs = daily_logs
        self.locator = locator
        self._leg_names = [leg.name for leg in route.legs]

    # ------------------------------------------------------------------ public

    def as_dict(self) -> dict:
        events = [self._event(e) for e in self.schedule.events]
        return {
            "inputs": {
                "current_location": self.inputs["current_location"],
                "pickup_location": self.inputs["pickup_location"],
                "dropoff_location": self.inputs["dropoff_location"],
                "current_cycle_used_hours": self.inputs["current_cycle_used_hours"],
                "start_time": _iso(self.inputs["start_time"]),
            },
            "locations": {key: loc.to_dict() for key, loc in self.locations.items()},
            "route": self._route(),
            "schedule": {
                "start_time": _iso(self.schedule.start_time),
                "end_time": _iso(self.schedule.end_time),
                "events": events,
                "stops": [e for e in events if e["is_stop"]],
                "summary": self._summary(),
            },
            "daily_logs": [self._daily_log(log) for log in self.daily_logs],
        }

    # ----------------------------------------------------------------- pieces

    def _route(self) -> dict:
        return {
            "distance_miles": _r(self.route.distance_miles, 1),
            "duration_hours": _r(self.route.duration_hours),
            "raw_duration_hours": _r(self.route.raw_duration_hours),
            "legs": [
                {
                    "name": leg.name,
                    "distance_miles": _r(leg.distance_miles, 1),
                    "duration_hours": _r(leg.duration_hours),
                    "raw_duration_hours": _r(leg.raw_duration_hours),
                }
                for leg in self.route.legs
            ],
            "geometry": {
                "type": "LineString",
                "coordinates": _downsample(self.route.geometry),
            },
        }

    def _summary(self) -> dict:
        s = self.schedule.summary
        return {
            "driving_hours": _r(s.driving_hours),
            "on_duty_hours": _r(s.on_duty_hours),
            "off_duty_hours": _r(s.off_duty_hours),
            "sleeper_berth_hours": _r(s.sleeper_berth_hours),
            "total_hours": _r(s.total_hours),
            "total_miles": _r(s.total_miles, 1),
            "total_days": len(self.daily_logs),
            "fuel_stops": s.fuel_stops,
            "breaks": s.breaks,
            "rests": s.rests,
            "restarts": s.restarts,
            "cycle_used_at_start": _r(s.cycle_used_at_start),
            "cycle_used_at_end": _r(s.cycle_used_at_end),
            "driving_hours_remaining": _r(s.driving_hours_remaining),
            "window_hours_remaining": _r(s.window_hours_remaining),
            "cycle_hours_remaining": _r(s.cycle_hours_remaining),
            "average_speed_mph": _r(s.total_miles / s.driving_hours, 1) if s.driving_hours else 0.0,
        }

    def _location_for(self, event_type: EventType, miles: float) -> dict | None:
        """Exact geocoded coordinates for pickup/drop-off, interpolated otherwise."""
        if event_type is EventType.PICKUP:
            return _point((self.locations["pickup"].lat, self.locations["pickup"].lon))
        if event_type is EventType.DROPOFF:
            return _point((self.locations["dropoff"].lat, self.locations["dropoff"].lon))
        if miles <= 0:
            return _point((self.locations["current"].lat, self.locations["current"].lon))
        return _point(self.locator.point_at_miles(miles))

    def _event(self, event: DutyEvent) -> dict:
        leg_name = (
            self._leg_names[event.leg_index]
            if event.leg_index is not None and event.leg_index < len(self._leg_names)
            else None
        )
        return {
            "status": event.status.value,
            "type": event.event_type.value,
            "label": event.label,
            "start": _iso(event.start),
            "end": _iso(event.end),
            "duration_hours": _r(event.duration_hours),
            "start_miles": _r(event.start_miles, 1),
            "end_miles": _r(event.end_miles, 1),
            "distance_miles": _r(event.distance_miles, 1),
            "leg": leg_name,
            "is_stop": event.is_stop,
            "location": self._location_for(event.event_type, event.start_miles),
            "cycle_used_after": _r(event.cycle_used_after),
        }

    def _entry(self, entry: LogEntry) -> dict:
        return {
            "status": entry.status.value,
            "type": entry.event_type.value,
            "label": entry.label,
            "start": _iso(entry.start),
            "end": _iso(entry.end),
            "start_minute": entry.start_minute,
            "end_minute": entry.end_minute,
            "duration_hours": _r(entry.duration_hours),
            "start_miles": _r(entry.start_miles, 1),
            "end_miles": _r(entry.end_miles, 1),
            "location": self._location_for(entry.event_type, entry.start_miles),
            "cycle_used_at_end": _r(entry.cycle_used_at_end),
        }

    def _place_label(self, miles: float, *, end_of_day: bool = False) -> str:
        """Name a point on the trip: one of the three geocoded places, else a route mile.

        When several places share an odometer reading (zero-length legs), a
        day's start prefers the earlier place and a day's end the later one.
        """
        candidates = [
            (0.0, self.inputs["current_location"]),
            (self.route.legs[0].distance_miles if self.route.legs else None, self.inputs["pickup_location"]),
            (self.route.distance_miles, self.inputs["dropoff_location"]),
        ]
        if end_of_day:
            candidates.reverse()
        for at_miles, label in candidates:
            if at_miles is not None and abs(miles - at_miles) < 0.05:
                return label
        return f"En route · mi {miles:,.1f}"

    def _place(self, miles: float, event_type: EventType, *, end_of_day: bool = False) -> dict:
        return {
            "label": self._place_label(miles, end_of_day=end_of_day),
            "miles": _r(miles, 1),
            "location": self._location_for(event_type, miles),
        }

    def _daily_log(self, log: DailyLog) -> dict:
        first, last = log.entries[0], log.entries[-1]
        return {
            "date": log.date.isoformat(),
            "day_number": log.day_number,
            "entries": [self._entry(e) for e in log.entries],
            "totals": {status: _r(hours) for status, hours in log.totals.items()},
            "totals_minutes": minute_totals(log.totals),
            "miles_driven": _r(log.miles_driven, 1),
            # Where the day started and ended (paper-log "From" / "To").
            "from": self._place(first.start_miles, first.event_type),
            "to": self._place(last.end_miles, last.event_type, end_of_day=True),
            # Paper-log recap for the 70-hour / 8-day rule.
            "recap": {
                "on_duty_hours_today": _r(log.on_duty_hours_today),
                "cycle_used_at_end_of_day": _r(log.cycle_used_at_end_of_day),
                "hours_available_tomorrow": _r(log.hours_available_tomorrow),
                "cycle_limit_hours": DEFAULT_RULES.cycle_limit_hours,
                "restart_completes_at": _iso(log.restart_completes_at) if log.restart_completes_at else None,
                "restart_completed_at": _iso(log.restart_completed_at) if log.restart_completed_at else None,
            },
        }


def present_plan(**kwargs) -> dict:
    return PlanPresenter(**kwargs).as_dict()
