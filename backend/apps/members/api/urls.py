from django.urls import path

from . import views

app_name = "members"

urlpatterns = [
    path("", views.DirectoryView.as_view(), name="directory"),
    path("register/", views.RegisterView.as_view(), name="register"),
    path("voice-sections/", views.VoiceSectionListView.as_view(), name="voice-sections"),
    path("me/", views.OwnProfileView.as_view(), name="me"),
    path("<uuid:public_id>/", views.MemberDetailView.as_view(), name="detail"),
]
