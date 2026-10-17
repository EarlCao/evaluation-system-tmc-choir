from django.contrib import admin, messages

from apps.core.exceptions import DomainError

from . import services
from .constants import UserStatus
from .models import User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    """Emergency access only (the audited React admin arrives in step 4.2). Records are
    read-only here; status changes go through actions that call the audited services."""

    list_display = ("username", "email", "first_name", "last_name", "role", "status", "date_joined")
    list_filter = ("role", "status")
    search_fields = ("username", "email", "first_name", "last_name")
    ordering = ("last_name", "first_name")
    actions = ("approve_selected", "suspend_selected", "reactivate_selected")
    exclude = ("password", "groups", "user_permissions")

    def get_readonly_fields(self, request, obj=None):
        return [f.name for f in self.model._meta.fields if f.name != "password"]

    def has_add_permission(self, request) -> bool:
        return False  # use registration or `manage.py create_super_admin`

    def has_delete_permission(self, request, obj=None) -> bool:
        return False  # soft delete only (status DEACTIVATED)

    def _apply(self, request, queryset, func, done: str) -> None:
        count = 0
        for user in queryset:
            try:
                func(user)
                count += 1
            except DomainError as exc:
                self.message_user(request, f"{user}: {exc.message}", messages.WARNING)
        if count:
            self.message_user(request, f"{count} account(s) {done}.", messages.SUCCESS)

    @admin.action(description="Approve selected pending accounts")
    def approve_selected(self, request, queryset):
        self._apply(
            request,
            queryset,
            lambda u: services.approve_user(actor=request.user, user=u),
            "approved",
        )

    @admin.action(description="Suspend selected accounts")
    def suspend_selected(self, request, queryset):
        self._apply(
            request,
            queryset,
            lambda u: services.set_user_status(
                actor=request.user, user=u, status=UserStatus.SUSPENDED, reason="admin action"
            ),
            "suspended",
        )

    @admin.action(description="Reactivate selected accounts")
    def reactivate_selected(self, request, queryset):
        self._apply(
            request,
            queryset,
            lambda u: services.set_user_status(
                actor=request.user, user=u, status=UserStatus.ACTIVE, reason="admin action"
            ),
            "reactivated",
        )
