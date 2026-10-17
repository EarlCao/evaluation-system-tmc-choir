"""Domain events published by accounts. Payloads carry IDs and states only, never names,
emails or raw login identifiers (Module Boundaries)."""

from dataclasses import dataclass
from typing import Any

from apps.core.events import DomainEvent

USER = "accounts.User"


@dataclass(frozen=True, kw_only=True)
class UserRegistered(DomainEvent):
    name = "accounts.user.registered"
    target_type = USER
    status: str
    registration_mode: str


@dataclass(frozen=True, kw_only=True)
class SuperAdminCreated(DomainEvent):
    name = "accounts.user.super_admin_created"
    target_type = USER


@dataclass(frozen=True, kw_only=True)
class LoggedIn(DomainEvent):
    name = "accounts.user.logged_in"
    target_type = USER


@dataclass(frozen=True, kw_only=True)
class LoggedOut(DomainEvent):
    name = "accounts.user.logged_out"
    target_type = USER


@dataclass(frozen=True, kw_only=True)
class LoginFailed(DomainEvent):
    """``identifier_hash`` is an HMAC of the submitted identifier: repeated attempts on
    one identifier can be correlated without storing what was typed."""

    name = "accounts.user.login_failed"
    target_type = USER
    identifier_hash: str


@dataclass(frozen=True, kw_only=True)
class PasswordChanged(DomainEvent):
    name = "accounts.password.changed"
    target_type = USER


@dataclass(frozen=True, kw_only=True)
class PasswordResetRequested(DomainEvent):
    name = "accounts.password.reset_requested"
    target_type = USER
    identifier_hash: str


@dataclass(frozen=True, kw_only=True)
class PasswordResetCompleted(DomainEvent):
    name = "accounts.password.reset_completed"
    target_type = USER


@dataclass(frozen=True, kw_only=True)
class EmailVerified(DomainEvent):
    name = "accounts.user.email_verified"
    target_type = USER


@dataclass(frozen=True, kw_only=True)
class ProfileUpdated(DomainEvent):
    name = "accounts.user.profile_updated"
    target_type = USER
    changed_fields: tuple[str, ...]


@dataclass(frozen=True, kw_only=True)
class UserStatusChanged(DomainEvent):
    name = "accounts.user.status_changed"
    target_type = USER
    changes: tuple[tuple[str, Any, Any], ...]
    reason: str = ""


@dataclass(frozen=True, kw_only=True)
class UserRoleChanged(DomainEvent):
    name = "accounts.user.role_changed"
    target_type = USER
    changes: tuple[tuple[str, Any, Any], ...]
