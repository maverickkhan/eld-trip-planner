"""
Geocoding via Nominatim (OpenStreetMap).

Nominatim is free and needs no API key.  Its usage policy asks for a
descriptive User-Agent and no more than one request per second, which the
client enforces with a process-wide throttle.  Results are cached so repeated
demos of the same trip do not hit the service again.
"""

from __future__ import annotations

import hashlib
import logging
import threading
import time
from dataclasses import asdict, dataclass

import requests
from django.conf import settings
from django.core.cache import cache

from .errors import GeocodingError, UpstreamServiceError

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 60 * 60 * 24 * 7


@dataclass(frozen=True)
class GeocodedLocation:
    query: str
    display_name: str
    lat: float
    lon: float

    def to_dict(self) -> dict:
        return asdict(self)


class _Throttle:
    """Ensure at least ``min_interval`` seconds between calls, across threads."""

    def __init__(self, min_interval: float):
        self.min_interval = min_interval
        self._lock = threading.Lock()
        self._last_call = 0.0

    def wait(self) -> None:
        with self._lock:
            now = time.monotonic()
            delay = self._last_call + self.min_interval - now
            if delay > 0:
                time.sleep(delay)
            self._last_call = time.monotonic()


_nominatim_throttle = _Throttle(settings.GEOCODER_MIN_INTERVAL_SECONDS)


class NominatimGeocoder:
    def __init__(
        self,
        base_url: str | None = None,
        user_agent: str | None = None,
        timeout: float | None = None,
        country_codes: str | None = None,
        session: requests.Session | None = None,
    ):
        self.base_url = (base_url or settings.GEOCODER_BASE_URL).rstrip("/")
        self.user_agent = user_agent or settings.GEOCODER_USER_AGENT
        self.timeout = timeout or settings.EXTERNAL_REQUEST_TIMEOUT_SECONDS
        self.country_codes = (
            country_codes if country_codes is not None else settings.GEOCODER_COUNTRY_CODES
        )
        self.session = session or requests.Session()

    @staticmethod
    def _cache_key(query: str) -> str:
        digest = hashlib.sha1(query.strip().lower().encode("utf-8")).hexdigest()
        return f"geocode:{digest}"

    def geocode(self, query: str) -> GeocodedLocation:
        query = query.strip()
        if not query:
            raise GeocodingError("Location must not be empty.")

        cache_key = self._cache_key(query)
        cached = cache.get(cache_key)
        if cached:
            return GeocodedLocation(**cached)

        params = {"q": query, "format": "jsonv2", "limit": 1, "addressdetails": 0}
        if self.country_codes:
            params["countrycodes"] = self.country_codes

        _nominatim_throttle.wait()
        try:
            response = self.session.get(
                f"{self.base_url}/search",
                params=params,
                headers={"User-Agent": self.user_agent, "Accept-Language": "en"},
                timeout=self.timeout,
            )
            response.raise_for_status()
            results = response.json()
        except requests.RequestException as exc:
            logger.warning("Geocoder request failed for %r: %s", query, exc)
            raise UpstreamServiceError("Geocoding service is unavailable. Please retry.") from exc
        except ValueError as exc:
            raise UpstreamServiceError("Geocoding service returned an invalid response.") from exc

        if not results:
            raise GeocodingError(f"Could not find a location matching '{query}'.")

        top = results[0]
        location = GeocodedLocation(
            query=query,
            display_name=top.get("display_name", query),
            lat=float(top["lat"]),
            lon=float(top["lon"]),
        )
        cache.set(cache_key, location.to_dict(), CACHE_TTL_SECONDS)
        return location
