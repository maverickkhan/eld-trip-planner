"""Domain errors raised by the external-service adapters."""


class TripPlanningError(Exception):
    """Base class for errors the API turns into a structured 4xx/5xx response."""

    status_code = 422
    code = "planning_error"


class GeocodingError(TripPlanningError):
    """A location string could not be resolved to coordinates."""

    status_code = 422
    code = "geocoding_failed"


class RoutingError(TripPlanningError):
    """The routing engine could not build a route between the points."""

    status_code = 422
    code = "routing_failed"


class UpstreamServiceError(TripPlanningError):
    """A free third-party service (Nominatim / OSRM) is down or rate-limiting."""

    status_code = 502
    code = "upstream_unavailable"
