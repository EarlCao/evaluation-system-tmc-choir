from django.urls import path

from . import admin_views

app_name = "system-admin"

urlpatterns = [path("settings/", admin_views.AdminSettingsView.as_view(), name="settings")]
