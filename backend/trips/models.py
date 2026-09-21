from django.db import models


class Trip(models.Model):
    """A planned trip: the four form inputs plus the computed plan.

    The full plan (route, schedule, daily logs) is stored as JSON so a trip
    can be re-opened via a permalink without re-hitting the free geocoding /
    routing services.
    """

    created_at = models.DateTimeField(auto_now_add=True)

    current_location = models.CharField(max_length=255)
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)
    current_cycle_used_hours = models.FloatField()
    # Naive wall-clock time in the driver's home-terminal zone (USE_TZ=False).
    start_time = models.DateTimeField()

    result = models.JSONField()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Trip #{self.pk}: {self.current_location} -> {self.pickup_location} -> {self.dropoff_location}"
