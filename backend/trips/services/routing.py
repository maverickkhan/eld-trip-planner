"""
Routing via OSRM (Open Source Routing Machine).

The public demo server (router.project-osrm.org) is free and key-less.  It
returns per-leg distance/duration and the full route geometry as GeoJSON,
which we use to place fuel and rest stops on the map.  The ``driving``
profile models a passenger car, so leg durations are stretched to respect a
configurable truck average-speed cap.
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import asdict, dataclass, field

import requests
from django.conf import settings
from django.core.cache import cache

from .errors import RoutingError, UpstreamServiceError

logger = logging.getLogger(__name__)

METERS_PER_MILE = 1609.344
CACHE_TTL_SECONDS = 60 * 60 * 24


@dataclass(frozen=True)
class RouteLeg:
    name: str
    distance_miles: float
    duration_hours: float  # planning duration (after truck speed cap)
    raw_duration_hours: float  # as returned by OSRM


@dataclass(frozen=True)
class RouteResult:
    distance_miles: float
    duration_hours: float
    raw_duration_hours: float
    legs: list[RouteLeg]
    geometry: list[list[float]] = field(default_factory=list)  # GeoJSON [lon, lat] pairs

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "RouteResult":
        legs = [RouteLeg(**leg) for leg in data["legs"]]
        return cls(
            distance_miles=data["distance_miles"],
            duration_hours=data["duration_hours"],
            raw_duration_hours=data["raw_duration_hours"],
            legs=legs,
            geometry=data["geometry"],
        )


class OSRMRouter:
    def __init__(
        self,
        base_url: str | None = None,
        profile: str | None = None,
        timeout: float | None = None,
        max_average_speed_mph: float | None = None,
        session: requests.Session | None = None,
    ):
        self.base_url = (base_url or settings.OSRM_BASE_URL).rstrip("/")
        self.profile = profile or settings.OSRM_PROFILE
        self.timeout = timeout or settings.EXTERNAL_REQUEST_TIMEOUT_SECONDS
        self.max_average_speed_mph = (
            max_average_speed_mph
            if max_average_speed_mph is not None
            else settings.TRUCK_MAX_AVERAGE_SPEED_MPH
        )
        self.session = session or requests.Session()

    def route(self, points: list[tuple[float, float]], leg_names: list[str]) -> RouteResult:
        """Route through ``points`` (lat, lon) in order.

        ``leg_names`` labels each of the ``len(points) - 1`` legs.
        """
        if len(points) < 2:
            raise RoutingError("At least two points are required to build a route.")
        if len(leg_names) != len(points) - 1:
            raise ValueError("leg_names must have one entry per leg.")

        cache_key = self._cache_key(points)
        cached = cache.get(cache_key)
        if cached:
            return RouteResult.from_dict(cached)

        coordinates = ";".join(f"{lon:.6f},{lat:.6f}" for lat, lon in points)
        url = f"{self.base_url}/route/v1/{self.profile}/{coordinates}"
        params = {
            "overview": "full",
            "geometries": "geojson",
            "steps": "false",
            "alternatives": "false",
            "annotations": "false",
        }

        try:
            response = self.session.get(url, params=params, timeout=self.timeout)
            payload = response.json()
        except requests.RequestException as exc:
            logger.warning("OSRM request failed: %s", exc)
            raise UpstreamServiceError("Routing service is unavailable. Please retry.") from exc
        except ValueError as exc:
            raise UpstreamServiceError("Routing service returned an invalid response.") from exc

        code = payload.get("code")
        if code != "Ok":
            message = payload.get("message") or code or f"HTTP {response.status_code}"
            if code in {"NoRoute", "NoSegment", "InvalidQuery", "InvalidValue"}:
                raise RoutingError(f"Could not build a driving route between these locations ({message}).")
            raise UpstreamServiceError(f"Routing service error: {message}")

        routes = payload.get("routes") or []
        if not routes:
            raise RoutingError("Routing service returned no routes.")
        route = routes[0]

        legs = []
        for name, leg in zip(leg_names, route.get("legs", [])):
            distance_miles = leg["distance"] / METERS_PER_MILE
            raw_hours = leg["duration"] / 3600.0
            legs.append(
                RouteLeg(
                    name=name,
                    distance_miles=distance_miles,
                    duration_hours=self._apply_speed_cap(distance_miles, raw_hours),
                    raw_duration_hours=raw_hours,
                )
            )
        if len(legs) != len(leg_names):
            raise UpstreamServiceError("Routing service returned an unexpected number of legs.")

        result = RouteResult(
            distance_miles=route["distance"] / METERS_PER_MILE,
            duration_hours=sum(leg.duration_hours for leg in legs),
            raw_duration_hours=route["duration"] / 3600.0,
            legs=legs,
            geometry=route.get("geometry", {}).get("coordinates", []),
        )
        cache.set(cache_key, result.to_dict(), CACHE_TTL_SECONDS)
        return result

    def _apply_speed_cap(self, distance_miles: float, raw_hours: float) -> float:
        if distance_miles <= 0:
            return max(raw_hours, 0.0)
        if self.max_average_speed_mph <= 0:
            return raw_hours
        return max(raw_hours, distance_miles / self.max_average_speed_mph)

    def _cache_key(self, points: list[tuple[float, float]]) -> str:
        raw = json.dumps(
            {
                "profile": self.profile,
                "cap": self.max_average_speed_mph,
                "points": [[round(lat, 5), round(lon, 5)] for lat, lon in points],
            },
            sort_keys=True,
        )
        return "route:" + hashlib.sha1(raw.encode("utf-8")).hexdigest()
