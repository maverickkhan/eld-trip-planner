from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.HealthView.as_view(), name="health"),
    path("trips/", views.TripListCreateView.as_view(), name="trip-list-create"),
    path("trips/<int:pk>/", views.TripDetailView.as_view(), name="trip-detail"),
]
