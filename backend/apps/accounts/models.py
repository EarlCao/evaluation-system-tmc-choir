from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.db import models
from django.utils import timezone

from apps.core.models import PublicIdModel

from .constants import UserRole, UserStatus


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email: str, username: str, password: str | None, **extra):
        if not email:
            raise ValueError("Users must have an email address.")
        if not username:
            raise ValueError("Users must have a username.")
        user = self.model(
            email=self.normalize_email(email).lower(),
            username=self.model.normalize_username(username),
            **extra,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, username: str, password: str | None = None, **extra):
        """Low-level creation. Application code uses ``accounts.services.create_user``."""
        extra.setdefault("role", UserRole.MEMBER)
        extra.setdefault("status", UserStatus.PENDING)
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, username, password, **extra)

    def create_superuser(self, email: str, username: str, password: str | None = None, **extra):
        """Used by Django's ``createsuperuser``; prefer ``manage.py create_super_admin``."""
        extra.update(
            role=UserRole.SUPER_ADMIN, status=UserStatus.ACTIVE, is_staff=True, is_superuser=True
        )
        return self._create_user(email, username, password, **extra)


class User(PublicIdModel, AbstractBaseUser, PermissionsMixin):
    """Custom user model (AUTH_USER_MODEL). Role and status are separate: only ACTIVE
    users can use the system, whatever their role."""

    email = models.EmailField(unique=True)
    username = models.CharField(
        max_length=150, unique=True, validators=[UnicodeUsernameValidator()]
    )
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    display_name = models.CharField(max_length=150, blank=True)

    role = models.CharField(
        max_length=32, choices=UserRole.choices, default=UserRole.MEMBER, db_index=True
    )
    status = models.CharField(
        max_length=32, choices=UserStatus.choices, default=UserStatus.PENDING, db_index=True
    )
    email_verified_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    is_staff = models.BooleanField(default=False, help_text="Django admin access (super admins).")
    date_joined = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "username"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = ["email", "first_name", "last_name"]

    class Meta:
        ordering = ["last_name", "first_name", "id"]

    def __str__(self) -> str:
        return self.username

    # Django's auth machinery (sessions, ModelBackend, admin) checks ``is_active``.
    # Deriving it from status means a suspended user's existing sessions stop working.
    @property
    def is_active(self) -> bool:
        return self.status == UserStatus.ACTIVE

    @property
    def is_active_member(self) -> bool:
        """Used by core.permissions.IsActiveMember."""
        return self.status == UserStatus.ACTIVE

    @property
    def is_super_admin(self) -> bool:
        """Used by core.permissions.IsSuperAdmin."""
        return self.role == UserRole.SUPER_ADMIN and self.status == UserStatus.ACTIVE

    def get_full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    def get_short_name(self) -> str:
        return self.display_name or self.first_name
