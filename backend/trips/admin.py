from django.contrib import admin

from .models import Trip


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "created_at",
        "current_location",
        "pickup_location",
        "dropoff_location",
        "current_cycle_used_hours",
        "start_time",
    )
    readonly_fields = ("created_at", "result")
    search_fields = ("current_location", "pickup_location", "dropoff_location")
