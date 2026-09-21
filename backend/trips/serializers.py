from datetime import datetime, timedelta

from rest_framework import serializers

from .hos import DEFAULT_RULES
from .models import Trip


def default_start_time() -> datetime:
    """Now, rounded up to the next quarter hour (naive local time)."""
    now = datetime.now().replace(second=0, microsecond=0)
    remainder = now.minute % 15
    if remainder:
        now += timedelta(minutes=15 - remainder)
    return now


class TripPlanRequestSerializer(serializers.Serializer):
    current_location = serializers.CharField(max_length=255, trim_whitespace=True)
    pickup_location = serializers.CharField(max_length=255, trim_whitespace=True)
    dropoff_location = serializers.CharField(max_length=255, trim_whitespace=True)
    current_cycle_used_hours = serializers.FloatField(
        min_value=0.0, max_value=DEFAULT_RULES.cycle_limit_hours
    )
    # Optional: naive local wall-clock time.  Defaults to "now".
    start_time = serializers.DateTimeField(required=False)

    def validate(self, attrs):
        attrs.setdefault("start_time", default_start_time())
        start_time = attrs["start_time"]
        if start_time.tzinfo is not None:
            attrs["start_time"] = start_time.replace(tzinfo=None)
        return attrs


class TripSummarySerializer(serializers.ModelSerializer):
    total_miles = serializers.SerializerMethodField()
    total_days = serializers.SerializerMethodField()
    total_hours = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = [
            "id",
            "created_at",
            "current_location",
            "pickup_location",
            "dropoff_location",
            "current_cycle_used_hours",
            "start_time",
            "total_miles",
            "total_days",
            "total_hours",
        ]

    @staticmethod
    def _summary(obj) -> dict:
        return (obj.result or {}).get("schedule", {}).get("summary", {})

    def get_total_miles(self, obj):
        return self._summary(obj).get("total_miles")

    def get_total_days(self, obj):
        return self._summary(obj).get("total_days")

    def get_total_hours(self, obj):
        return self._summary(obj).get("total_hours")
