"""
Re-run the planner for saved trips so their stored results match the current
engine / presenter (e.g. after adding fields to the API response).  Trip ids
and permalinks are preserved; only ``result`` is rewritten.

    python manage.py replan_trips            # all trips
    python manage.py replan_trips --ids 3 7  # selected trips
    python manage.py replan_trips --dry-run  # plan but do not save
"""

from django.core.management.base import BaseCommand

from trips.hos import HOSPlanningError
from trips.models import Trip
from trips.services.errors import TripPlanningError
from trips.services.planner import plan_trip


class Command(BaseCommand):
    help = "Re-plan saved trips with the current engine and overwrite their stored results."

    def add_arguments(self, parser):
        parser.add_argument("--ids", nargs="*", type=int, help="Only these trip ids (default: all).")
        parser.add_argument("--dry-run", action="store_true", help="Plan but do not write to the database.")

    def handle(self, *args, **options):
        queryset = Trip.objects.order_by("id")
        if options["ids"]:
            queryset = queryset.filter(id__in=options["ids"])

        ok = failed = 0
        for trip in queryset:
            try:
                result = plan_trip(
                    current_location=trip.current_location,
                    pickup_location=trip.pickup_location,
                    dropoff_location=trip.dropoff_location,
                    current_cycle_used_hours=trip.current_cycle_used_hours,
                    start_time=trip.start_time,
                )
            except (TripPlanningError, HOSPlanningError) as exc:
                failed += 1
                self.stderr.write(f"#{trip.id} failed: {exc}")
                continue

            if not options["dry_run"]:
                trip.result = result
                trip.save(update_fields=["result"])
            ok += 1
            summary = result["schedule"]["summary"]
            self.stdout.write(
                f"#{trip.id} {trip.current_location} -> {trip.pickup_location} -> {trip.dropoff_location}: "
                f"{summary['total_miles']} mi, {summary['total_days']} day(s)"
                + (" [dry run]" if options["dry_run"] else "")
            )

        self.stdout.write(self.style.SUCCESS(f"{ok} re-planned, {failed} failed"))
