from zoneinfo import available_timezones

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models

from apps.core.models import TimeStampedModel

from .constants import DEFAULT_PRIVACY_NOTICE, MIN_AGGREGATE_GROUP_SIZE_FLOOR, RegistrationMode

SINGLETON_PK = 1


def validate_time_zone(value: str) -> None:
    if value not in available_timezones():
        raise ValidationError(f"Unknown time zone: {value}")


class SystemSettings(TimeStampedModel):
    """Singleton (pk=1). Read via ``system.selectors.get_settings()``, change via
    ``system.services.update_settings()`` (cached + audited)."""

    system_name = models.CharField(max_length=120, default="Choir Member Evaluation System")
    choir_name = models.CharField(max_length=120, blank=True)
    choir_description = models.TextField(blank=True, max_length=2000)
    time_zone = models.CharField(max_length=64, default="UTC", validators=[validate_time_zone])

    registration_mode = models.CharField(
        max_length=32, choices=RegistrationMode.choices, default=RegistrationMode.APPROVAL
    )
    min_aggregate_group_size = models.PositiveSmallIntegerField(
        default=MIN_AGGREGATE_GROUP_SIZE_FLOOR,
        validators=[MinValueValidator(MIN_AGGREGATE_GROUP_SIZE_FLOOR)],
    )
    min_comment_prompts = models.PositiveSmallIntegerField(
        default=5,
        validators=[MinValueValidator(1)],
    )
    feedback_notification_debounce_minutes = models.PositiveSmallIntegerField(default=60)
    privacy_notice = models.TextField(default=DEFAULT_PRIVACY_NOTICE, max_length=10000)

    # Retention in days; null = keep forever (SET-02, applied in step 6.4).
    retention_evaluations_days = models.PositiveIntegerField(null=True, blank=True)
    retention_revisions_days = models.PositiveIntegerField(null=True, blank=True)
    retention_audit_days = models.PositiveIntegerField(
        null=True, blank=True, default=730, validators=[MinValueValidator(30)]
    )

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        verbose_name = "system settings"
        verbose_name_plural = "system settings"

    def __str__(self) -> str:
        return self.system_name

    def save(self, *args, **kwargs):
        if self._state.adding and type(self).objects.filter(pk=SINGLETON_PK).exists():
            # A second instance would overwrite the row (and wipe created_at).
            raise ValidationError("System settings already exist; use SystemSettings.load().")
        self.pk = SINGLETON_PK
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("System settings cannot be deleted.")

    @classmethod
    def load(cls) -> "SystemSettings":
        obj, _ = cls.objects.get_or_create(pk=SINGLETON_PK)
        return obj
