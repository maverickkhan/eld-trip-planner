from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Trip
from .serializers import TripPlanRequestSerializer, TripSummarySerializer
from .services.planner import plan_trip

RECENT_TRIPS_LIMIT = 20


def _with_identity(trip: Trip) -> dict:
    payload = dict(trip.result)
    payload["id"] = trip.pk
    payload["created_at"] = trip.created_at.isoformat(timespec="seconds")
    return payload


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok"})


class TripListCreateView(APIView):
    """POST a trip request to plan it; GET the most recent planned trips."""

    def get(self, request):
        trips = Trip.objects.all()[:RECENT_TRIPS_LIMIT]
        return Response(TripSummarySerializer(trips, many=True).data)

    def post(self, request):
        serializer = TripPlanRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        plan = plan_trip(**data)

        trip = Trip.objects.create(
            current_location=data["current_location"],
            pickup_location=data["pickup_location"],
            dropoff_location=data["dropoff_location"],
            current_cycle_used_hours=data["current_cycle_used_hours"],
            start_time=data["start_time"],
            result=plan,
        )
        return Response(_with_identity(trip), status=status.HTTP_201_CREATED)


class TripDetailView(APIView):
    def get(self, request, pk: int):
        trip = get_object_or_404(Trip, pk=pk)
        return Response(_with_identity(trip))
