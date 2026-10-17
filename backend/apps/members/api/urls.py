from django.urls import path

from . import views

app_name = "members"

urlpatterns = [
    path("register/", views.RegisterView.as_view(), name="register"),
    path("voice-sections/", views.VoiceSectionListView.as_view(), name="voice-sections"),
]
