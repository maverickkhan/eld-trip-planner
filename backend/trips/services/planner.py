"""
Orchestrates one trip plan: geocode -> route -> HOS engine -> daily logs.

Every collaborator is injectable so the API layer can be tested with fake
geocoders/routers and the engine can be swapped for a rules variant.
"""

from __future__ import annotations

from datetime import datetime

from ..hos import HOSEngine, Leg, TripPlanRequest, build_daily_logs
from ..presenters import present_plan
from .geocoding import NominatimGeocoder
from .geometry import RouteLocator
from .routing import OSRMRouter

LEG_NAMES = ["to_pickup", "to_dropoff"]


def plan_trip(
    *,
    current_location: str,
    pickup_location: str,
    dropoff_location: str,
    current_cycle_used_hours: float,
    start_time: datetime,
    geocoder: NominatimGeocoder | None = None,
    router: OSRMRouter | None = None,
    engine: HOSEngine | None = None,
) -> dict:
    geocoder = geocoder or NominatimGeocoder()
    router = router or OSRMRouter()
    engine = engine or HOSEngine()

    locations = {
        "current": geocoder.geocode(current_location),
        "pickup": geocoder.geocode(pickup_location),
        "dropoff": geocoder.geocode(dropoff_location),
    }

    route = router.route(
        [(loc.lat, loc.lon) for loc in (locations["current"], locations["pickup"], locations["dropoff"])],
        LEG_NAMES,
    )

    legs = [Leg(leg.name, leg.distance_miles, leg.duration_hours) for leg in route.legs]
    schedule = engine.plan(
        TripPlanRequest(start_time=start_time, cycle_used_hours=current_cycle_used_hours, legs=legs)
    )
    daily_logs = build_daily_logs(schedule)
    locator = RouteLocator(route.geometry, route.distance_miles)

    return present_plan(
        inputs={
            "current_location": current_location,
            "pickup_location": pickup_location,
            "dropoff_location": dropoff_location,
            "current_cycle_used_hours": current_cycle_used_hours,
            "start_time": start_time,
        },
        locations=locations,
        route=route,
        schedule=schedule,
        daily_logs=daily_logs,
        locator=locator,
    )
