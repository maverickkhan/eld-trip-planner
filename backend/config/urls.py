from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def root(request):
    return JsonResponse(
        {
            "service": "eld-trip-planner",
            "endpoints": {
                "health": "/api/health/",
                "plan_trip": "POST /api/trips/",
                "recent_trips": "GET /api/trips/",
                "trip_detail": "GET /api/trips/<id>/",
            },
        }
    )


urlpatterns = [
    path("", root),
    path("admin/", admin.site.urls),
    path("api/", include("trips.urls")),
]
