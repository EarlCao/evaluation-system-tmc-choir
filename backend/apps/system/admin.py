from django.contrib import admin

from . import services
from .models import SystemSettings


@admin.register(SystemSettings)
class SystemSettingsAdmin(admin.ModelAdmin):
    """Emergency access only. Saves go through the service so they are validated,
    cached correctly and audited."""

    readonly_fields = ("updated_by", "created_at", "updated_at")

    def has_add_permission(self, request) -> bool:
        return not SystemSettings.objects.exists()

    def has_delete_permission(self, request, obj=None) -> bool:
        return False

    def save_model(self, request, obj, form, change) -> None:
        changes = {
            field: form.cleaned_data[field]
            for field in form.changed_data
            if field in services.EDITABLE_FIELDS
        }
        services.update_settings(actor=request.user, **changes)
