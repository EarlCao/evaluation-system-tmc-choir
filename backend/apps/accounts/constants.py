from django.db import models


class UserRole(models.TextChoices):
    MEMBER = "MEMBER", "Choir member"
    SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"


class UserStatus(models.TextChoices):
    PENDING = "PENDING", "Pending approval / verification"
    ACTIVE = "ACTIVE", "Active"
    SUSPENDED = "SUSPENDED", "Suspended"
    DEACTIVATED = "DEACTIVATED", "Deactivated"


# One generic message for every login failure so responses never reveal whether an
# account exists or what state it is in (Security Model).
INVALID_CREDENTIALS_MESSAGE = "Invalid credentials or account not active."
# S105: a user-facing message, not a password.
PASSWORD_RESET_SENT_MESSAGE = "If an account exists for this email, a reset link has been sent."  # noqa: S105
INVALID_LINK_MESSAGE = "This link is invalid or has expired."
