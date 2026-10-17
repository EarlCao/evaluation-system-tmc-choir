from django.contrib import admin

from .models import MemberProfile, VoiceSection


@admin.register(VoiceSection)
class VoiceSectionAdmin(admin.ModelAdmin):
    list_display = ("name", "sort_order", "is_active")
    list_editable = ("sort_order", "is_active")

    def has_delete_permission(self, request, obj=None) -> bool:
        return False  # deactivate instead; profiles reference sections


@admin.register(MemberProfile)
class MemberProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "voice_section", "is_evaluable")
    list_filter = ("voice_section", "is_evaluable")
    search_fields = ("user__username", "user__first_name", "user__last_name")
    readonly_fields = ("user", "created_at", "updated_at")

    def has_add_permission(self, request) -> bool:
        return False  # created at registration

    def has_delete_permission(self, request, obj=None) -> bool:
        return False
