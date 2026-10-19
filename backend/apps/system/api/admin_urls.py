from django.urls import path

from . import admin_views

app_name = "system-admin"

urlpatterns = [
    path("settings/", admin_views.AdminSettingsView.as_view(), name="settings"),
    path("backups/", admin_views.AdminBackupListView.as_view(), name="backup-list"),
    path("backups/restore/", admin_views.AdminRestoreView.as_view(), name="backup-restore"),
    path(
        "backups/<str:filename>/download/",
        admin_views.AdminBackupDownloadView.as_view(),
        name="backup-download",
    ),
    path(
        "backups/<str:filename>/",
        admin_views.AdminBackupDeleteView.as_view(),
        name="backup-delete",
    ),
    path(
        "data-management/cleanup/",
        admin_views.AdminRetentionCleanupView.as_view(),
        name="data-cleanup",
    ),
]
