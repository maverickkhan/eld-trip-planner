import pytest

from trips.services.geometry import RouteLocator, haversine_miles


def test_haversine_known_distance():
    # Chicago -> Dallas great-circle distance is ~803 miles.
    assert haversine_miles(41.8781, -87.6298, 32.7767, -96.7970) == pytest.approx(803, abs=5)


class TestRouteLocator:
    # A straight east-west line along the equator: 1 degree ~ 69.1 miles.
    geometry = [[0.0, 0.0], [1.0, 0.0], [2.0, 0.0]]  # [lon, lat]

    def test_endpoints(self):
        total = haversine_miles(0, 0, 0, 2)
        locator = RouteLocator(self.geometry, route_distance_miles=total)
        assert locator.point_at_miles(0) == pytest.approx((0.0, 0.0))
        assert locator.point_at_miles(total) == pytest.approx((0.0, 2.0))

    def test_midpoint_interpolates_between_vertices(self):
        total = haversine_miles(0, 0, 0, 2)
        locator = RouteLocator(self.geometry, route_distance_miles=total)
        lat, lon = locator.point_at_miles(total * 0.75)
        assert lat == pytest.approx(0.0)
        assert lon == pytest.approx(1.5, abs=1e-6)

    def test_scales_road_miles_to_geometry_length(self):
        # Road distance is 10% longer than the drawn line; 55% of the road
        # trip should still land at 55% of the line.
        geometry_len = haversine_miles(0, 0, 0, 2)
        locator = RouteLocator(self.geometry, route_distance_miles=geometry_len * 1.1)
        lat, lon = locator.point_at_miles(geometry_len * 1.1 * 0.55)
        assert lon == pytest.approx(1.1, abs=1e-6)

    def test_clamps_out_of_range(self):
        locator = RouteLocator(self.geometry, route_distance_miles=100)
        assert locator.point_at_miles(-50) == pytest.approx((0.0, 0.0))
        assert locator.point_at_miles(1e9) == pytest.approx((0.0, 2.0))

    def test_degenerate_geometry(self):
        assert RouteLocator([], 10).point_at_miles(5) is None
        assert RouteLocator([[3.0, 4.0]], 10).point_at_miles(5) == (4.0, 3.0)
