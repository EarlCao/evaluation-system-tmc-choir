from django.urls import path

from . import admin_views as v

app_name = "audit-admin"

urlpatterns = [
    path("audit-logs/", v.AuditLogListView.as_view(), name="logs"),
    path("audit-logs/event-types/", v.AuditEventTypesView.as_view(), name="event-types"),
    path("audit-logs/export/", v.AuditExportView.as_view(), name="export"),
    path("audit-logs/<int:pk>/", v.AuditLogDetailView.as_view(), name="log"),
]
