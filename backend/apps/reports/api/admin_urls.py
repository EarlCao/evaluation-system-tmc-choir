from django.urls import path

from . import admin_views

app_name = "reports-admin"

urlpatterns = [
    path("reports/dashboard/", admin_views.AdminDashboardView.as_view(), name="dashboard"),
    path("reports/choir/", admin_views.ChoirSummaryView.as_view(), name="choir"),
    path(
        "reports/members/<uuid:public_id>/", admin_views.MemberSummaryView.as_view(), name="member"
    ),
    path(
        "reports/participation/",
        admin_views.ParticipationReportView.as_view(),
        name="participation",
    ),
    path("reports/export/", admin_views.ExportView.as_view(), name="export"),
]
