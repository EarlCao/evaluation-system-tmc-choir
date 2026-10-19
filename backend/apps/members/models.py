from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class VoiceSection(models.Model):
    """Soprano, Alto, Tenor, Bass, ... (seeded by migration, editable by the Super Admin)."""

    name = models.CharField(max_length=50, unique=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name


class MemberProfile(TimeStampedModel):
    """Choir-specific data for a user. Created together with the account at registration."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        primary_key=True,
        on_delete=models.CASCADE,
        related_name="member_profile",
    )
    voice_section = models.ForeignKey(
        VoiceSection, on_delete=models.PROTECT, related_name="members"
    )
    is_officer = models.BooleanField(default=False)
    officer_position = models.CharField(max_length=100, blank=True, default="")
    joined_choir_on = models.DateField(null=True, blank=True)
    bio = models.TextField(blank=True, max_length=500)
    is_evaluable = models.BooleanField(
        default=True, help_text="Untick to exclude this member from being evaluated."
    )

    def __str__(self) -> str:
        return f"{self.user} ({self.voice_section})"
