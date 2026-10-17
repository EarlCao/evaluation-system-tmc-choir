from django.urls import path

from . import admin_views as v

app_name = "members-admin"

urlpatterns = [
    path("members/", v.AdminMemberListView.as_view(), name="members"),
    path("members/<uuid:public_id>/", v.AdminMemberDetailView.as_view(), name="member"),
    path("members/<uuid:public_id>/approve/", v.AdminApproveView.as_view(), name="approve"),
    path("members/<uuid:public_id>/status/", v.AdminStatusView.as_view(), name="status"),
    path("members/<uuid:public_id>/role/", v.AdminRoleView.as_view(), name="role"),
    path(
        "members/<uuid:public_id>/send-password-reset/",
        v.AdminPasswordResetView.as_view(),
        name="password-reset",
    ),
    path("voice-sections/", v.AdminVoiceSectionListView.as_view(), name="voice-sections"),
    path("voice-sections/<int:pk>/", v.AdminVoiceSectionDetailView.as_view(), name="voice-section"),
]
