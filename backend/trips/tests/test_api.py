"""
API tests.  External services are replaced with in-memory fakes so the tests
are deterministic and offline; the HOS engine runs for real.
"""

from datetime import datetime
from unittest import mock

import pytest
from rest_framework.test import APIClient

from trips.models import Trip
from trips.services.errors import GeocodingError, UpstreamServiceError
from trips.services.geocoding import GeocodedLocation
from trips.services.routing import RouteLeg, RouteResult

FAKE_PLACES = {
    "chicago, il": GeocodedLocation("Chicago, IL", "Chicago, Cook County, Illinois, USA", 41.8781, -87.6298),
    "joliet, il": GeocodedLocation("Joliet, IL", "Joliet, Will County, Illinois, USA", 41.5250, -88.0817),
    "dallas, tx": GeocodedLocation("Dallas, TX", "Dallas, Dallas County, Texas, USA", 32.7767, -96.7970),
}


class FakeGeocoder:
    def geocode(self, query):
        try:
            return FAKE_PLACES[query.strip().lower()]
        except KeyError:
            raise GeocodingError(f"Could not find a location matching '{query}'.")


class FakeRouter:
    def __init__(self, to_pickup=(45.0, 0.8), to_dropoff=(925.0, 15.5)):
        self.to_pickup = to_pickup
        self.to_dropoff = to_dropoff
        self.calls = []

    def route(self, points, leg_names):
        self.calls.append((points, leg_names))
        legs = [
            RouteLeg("to_pickup", self.to_pickup[0], self.to_pickup[1], self.to_pickup[1]),
            RouteLeg("to_dropoff", self.to_dropoff[0], self.to_dropoff[1], self.to_dropoff[1]),
        ]
        geometry = [[lon, lat] for lat, lon in points]  # straight lines between points
        return RouteResult(
            distance_miles=sum(l.distance_miles for l in legs),
            duration_hours=sum(l.duration_hours for l in legs),
            raw_duration_hours=sum(l.raw_duration_hours for l in legs),
            legs=legs,
            geometry=geometry,
        )


class FlakyRouter(FakeRouter):
    def route(self, points, leg_names):
        raise UpstreamServiceError("Routing service is unavailable. Please retry.")


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def fake_services():
    router = FakeRouter()
    with (
        mock.patch("trips.services.planner.NominatimGeocoder", return_value=FakeGeocoder()),
        mock.patch("trips.services.planner.OSRMRouter", return_value=router),
    ):
        yield router


PAYLOAD = {
    "current_location": "Chicago, IL",
    "pickup_location": "Joliet, IL",
    "dropoff_location": "Dallas, TX",
    "current_cycle_used_hours": 12,
    "start_time": "2026-09-21T06:00",
}


@pytest.mark.django_db
class TestPlanTrip:
    def test_returns_full_plan_and_persists_trip(self, client, fake_services):
        response = client.post("/api/trips/", PAYLOAD, format="json")

        assert response.status_code == 201, response.content
        body = response.json()
        assert body["id"] == Trip.objects.get().pk
        assert body["inputs"]["start_time"] == "2026-09-21T06:00"
        assert set(body["locations"]) == {"current", "pickup", "dropoff"}
        assert body["route"]["distance_miles"] == pytest.approx(970.0)
        assert body["route"]["geometry"]["type"] == "LineString"

        summary = body["schedule"]["summary"]
        assert summary["total_miles"] == pytest.approx(970.0)
        assert summary["driving_hours"] == pytest.approx(16.3)
        assert summary["rests"] == 1
        assert summary["fuel_stops"] == 0
        assert summary["total_days"] == len(body["daily_logs"]) == 2

        types = [e["type"] for e in body["schedule"]["events"]]
        assert types[0] == "drive" and types[1] == "pickup" and types[-1] == "dropoff"
        assert "rest" in types and "break" in types

        stops = body["schedule"]["stops"]
        assert all(s["location"] is not None for s in stops)
        pickup = next(s for s in stops if s["type"] == "pickup")
        assert pickup["location"] == {"lat": 41.525, "lon": -88.0817}

        for log in body["daily_logs"]:
            assert sum(log["totals"].values()) == pytest.approx(24.0, abs=0.05)
            assert log["entries"][0]["start_minute"] == 0
            assert log["entries"][-1]["end_minute"] == 1440

    def test_router_receives_geocoded_points_in_order(self, client, fake_services):
        client.post("/api/trips/", PAYLOAD, format="json")
        (points, leg_names), = fake_services.calls
        assert leg_names == ["to_pickup", "to_dropoff"]
        assert points == [(41.8781, -87.6298), (41.525, -88.0817), (32.7767, -96.797)]

    def test_start_time_defaults_to_now_when_omitted(self, client, fake_services):
        payload = {k: v for k, v in PAYLOAD.items() if k != "start_time"}
        response = client.post("/api/trips/", payload, format="json")
        assert response.status_code == 201
        start = datetime.fromisoformat(response.json()["inputs"]["start_time"])
        assert abs((start - datetime.now()).total_seconds()) < 20 * 60

    def test_validation_errors(self, client, fake_services):
        response = client.post(
            "/api/trips/", {**PAYLOAD, "current_cycle_used_hours": 80}, format="json"
        )
        assert response.status_code == 400
        assert "current_cycle_used_hours" in response.json()

        response = client.post("/api/trips/", {"pickup_location": "x"}, format="json")
        assert response.status_code == 400
        assert Trip.objects.count() == 0

    def test_unknown_location_yields_422(self, client, fake_services):
        response = client.post(
            "/api/trips/", {**PAYLOAD, "pickup_location": "Nowhereville"}, format="json"
        )
        assert response.status_code == 422
        assert response.json()["code"] == "geocoding_failed"
        assert Trip.objects.count() == 0

    def test_upstream_failure_yields_502(self, client):
        with (
            mock.patch("trips.services.planner.NominatimGeocoder", return_value=FakeGeocoder()),
            mock.patch("trips.services.planner.OSRMRouter", return_value=FlakyRouter()),
        ):
            response = client.post("/api/trips/", PAYLOAD, format="json")
        assert response.status_code == 502
        assert response.json()["code"] == "upstream_unavailable"


@pytest.mark.django_db
class TestTripRetrieval:
    def test_detail_and_list(self, client, fake_services):
        created = client.post("/api/trips/", PAYLOAD, format="json").json()

        detail = client.get(f"/api/trips/{created['id']}/")
        assert detail.status_code == 200
        assert detail.json()["schedule"] == created["schedule"]

        listing = client.get("/api/trips/")
        assert listing.status_code == 200
        (item,) = listing.json()
        assert item["id"] == created["id"]
        assert item["total_days"] == 2
        assert item["total_miles"] == pytest.approx(970.0)

    def test_missing_trip_404(self, client):
        assert client.get("/api/trips/999/").status_code == 404


def test_health(client):
    response = client.get("/api/health/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
