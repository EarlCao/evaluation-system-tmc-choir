"""Public write API of the audit module.

``record`` may be called directly by other modules when the entry must be written in
the same transaction as the business change, or to log sensitive *read* access
(Module Boundaries). Everything else is recorded from domain events (handlers.py).
"""

from collections.abc import Mapping
from typing import Any

from django.contrib.auth import get_user_model

from apps.core.middleware import get_request_context

from .models import AuditLog

REDACTED = "[REDACTED]"
_SENSITIVE_KEY_PARTS = ("password", "passwd", "secret", "token", "api_key", "session")


def _is_sensitive(key: str) -> bool:
    lowered = key.lower()
    return any(part in lowered for part in _SENSITIVE_KEY_PARTS)


def redact(value: Any) -> Any:
    """Recursively replace values of sensitive-looking keys (AUD-02: no secrets in logs)."""
    if isinstance(value, Mapping):
        return {k: REDACTED if _is_sensitive(str(k)) else redact(v) for k, v in value.items()}
    if isinstance(value, list | tuple):
        return [redact(v) for v in value]
    return value


def record(
    *,
    event_type: str,
    actor=None,
    actor_id: int | None = None,
    target_type: str = "",
    target_id: str | int | None = None,
    before: Mapping | None = None,
    after: Mapping | None = None,
    metadata: Mapping | None = None,
) -> AuditLog:
    """Write one audit entry. Request IP / user agent / request id are taken from the
    current request context when there is one."""
    if actor is None and actor_id is not None:
        actor = get_user_model().objects.filter(pk=actor_id).first()

    context = get_request_context()
    return AuditLog.objects.create(
        actor=actor,
        actor_role=str(getattr(actor, "role", "") or ""),
        event_type=event_type,
        target_type=target_type,
        target_id="" if target_id is None else str(target_id),
        before=redact(dict(before)) if before is not None else None,
        after=redact(dict(after)) if after is not None else None,
        metadata=redact(dict(metadata or {})),
        ip_address=context.ip_address if context else None,
        user_agent=context.user_agent if context else "",
        request_id=context.request_id if context else "",
    )
