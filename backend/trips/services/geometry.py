"""
Geometry helpers: locate a point a given number of miles along a route.

OSRM's reported distance is measured on the road network while the returned
geometry is a simplified polyline, so the two lengths differ slightly.  The
locator scales odometer miles by the ratio of the two so stops land at the
right fraction of the drawn line.
"""

from __future__ import annotations

import bisect
import math

EARTH_RADIUS_MILES = 3958.7613


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = phi2 - phi1
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_MILES * math.asin(math.sqrt(a))


class RouteLocator:
    """Map trip odometer miles to a (lat, lon) on the route polyline."""

    def __init__(self, geometry_lonlat: list[list[float]], route_distance_miles: float):
        self.points = [(float(lat), float(lon)) for lon, lat in geometry_lonlat]
        self.cumulative: list[float] = [0.0]
        for (lat1, lon1), (lat2, lon2) in zip(self.points, self.points[1:]):
            self.cumulative.append(self.cumulative[-1] + haversine_miles(lat1, lon1, lat2, lon2))
        self.geometry_miles = self.cumulative[-1] if self.points else 0.0
        self.route_distance_miles = route_distance_miles

    @property
    def scale(self) -> float:
        if self.route_distance_miles <= 0 or self.geometry_miles <= 0:
            return 1.0
        return self.geometry_miles / self.route_distance_miles

    def point_at_miles(self, odometer_miles: float) -> tuple[float, float] | None:
        if not self.points:
            return None
        if len(self.points) == 1:
            return self.points[0]

        target = min(max(odometer_miles * self.scale, 0.0), self.geometry_miles)
        index = bisect.bisect_right(self.cumulative, target) - 1
        index = min(max(index, 0), len(self.points) - 2)

        seg_start, seg_end = self.cumulative[index], self.cumulative[index + 1]
        seg_len = seg_end - seg_start
        t = 0.0 if seg_len <= 0 else (target - seg_start) / seg_len

        (lat1, lon1), (lat2, lon2) = self.points[index], self.points[index + 1]
        return (lat1 + (lat2 - lat1) * t, lon1 + (lon2 - lon1) * t)
