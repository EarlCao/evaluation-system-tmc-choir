from django.urls import path

from . import admin_views

app_name = "reports-admin"

urlpatterns = [
    path("reports/dashboard/", admin_views.AdminDashboardView.as_view(), name="dashboard"),
]
