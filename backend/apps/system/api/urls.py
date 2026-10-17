from django.urls import path

from . import views

app_name = "system"

urlpatterns = [path("public/", views.PublicSettingsView.as_view(), name="public")]
