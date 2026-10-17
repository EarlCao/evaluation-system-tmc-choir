from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q


class EmailOrUsernameBackend(ModelBackend):
    """Log in with email or username (case-insensitive). Inactive (non-ACTIVE) users
    never authenticate. Runs the password hasher even for unknown identifiers so
    response timing does not reveal which accounts exist."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        identifier = (username or kwargs.get("identifier") or "").strip()
        if not identifier or password is None:
            return None

        user_model = get_user_model()
        user = (
            user_model._default_manager.filter(
                Q(username__iexact=identifier) | Q(email__iexact=identifier)
            )
            .order_by("id")
            .first()
        )
        if user is None:
            user_model().set_password(password)  # equalise timing
            return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
