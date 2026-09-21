"""Turn domain errors into structured JSON error responses."""

from __future__ import annotations

import logging

from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from .hos import HOSPlanningError
from .services.errors import TripPlanningError

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    if isinstance(exc, TripPlanningError):
        return Response({"detail": str(exc), "code": exc.code}, status=exc.status_code)
    if isinstance(exc, HOSPlanningError):
        return Response({"detail": str(exc), "code": "hos_planning_failed"}, status=422)

    response = drf_exception_handler(exc, context)
    if response is None:
        logger.exception("Unhandled error in %s", context.get("view"))
    return response
