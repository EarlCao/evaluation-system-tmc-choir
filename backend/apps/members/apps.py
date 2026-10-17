from django.apps import AppConfig


class MembersConfig(AppConfig):
    """Choir member profiles, voice sections, directory (MEM-01..05) and the
    registration use-case (ADR-004)."""

    name = "apps.members"
    label = "members"
    verbose_name = "Members"
