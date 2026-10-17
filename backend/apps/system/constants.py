from django.db import models


class RegistrationMode(models.TextChoices):
    """How new member accounts become active (AUTH-03, Open Question Q1)."""

    OPEN = "OPEN", "Open: accounts are active immediately"
    APPROVAL = "APPROVAL", "Super Admin approval required"
    EMAIL_VERIFICATION = "EMAIL_VERIFICATION", "Email verification required"
    CLOSED = "CLOSED", "Registration closed"


# Privacy floor: aggregates over fewer than 3 evaluations could reveal an evaluator
# (with n=2, a recipient who knows one evaluator can deduce the other). ADR-013.
MIN_AGGREGATE_GROUP_SIZE_FLOOR = 3

SETTINGS_CACHE_KEY = "system:settings:v1"
SETTINGS_CACHE_TIMEOUT_SECONDS = 60

DEFAULT_PRIVACY_NOTICE = (
    "Your name will not be shown to the member you evaluate or to other members. "
    "The Super Admin can see who submitted each evaluation. Edits to your evaluations "
    "are kept in a history that only you and the Super Admin can see."
)
