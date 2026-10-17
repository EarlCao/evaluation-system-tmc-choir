from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Read-only view (AUD-03). The audited viewer for day-to-day use arrives in step 4.6."""

    list_display = ("occurred_at", "event_type", "actor", "target_type", "target_id", "ip_address")
    list_filter = ("event_type",)
    search_fields = ("event_type", "target_type", "target_id", "request_id")
    date_hierarchy = "occurred_at"

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False
