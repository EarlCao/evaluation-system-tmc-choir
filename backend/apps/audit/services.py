"""Public write API of the audit module.

``record`` may be called directly by other modules when the entry must be written in
the same transaction as the business change, or to log sensitive *read* access
(Module Boundaries). Everything else is recorded from domain events (handlers.py).
"""

import json
from collections.abc import Mapping
from datetime import timedelta
from typing import Any

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models, transaction
from django.utils import timezone

from apps.core.exceptions import BusinessRuleViolation, NotFound, PermissionDenied, ValidationError
from apps.core.exports import CONTENT_TYPES, Document, Table, render
from apps.core.middleware import get_request_context

from . import selectors
from .constants import CLEAR_CONFIRMATION, DELETION_EVENTS
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


EXPORT_EVENT = "audit.export.generated"
EXPORT_LIMIT = 50_000


def export_logs(*, actor, file_type: str, filters: dict):
    """AUD-04: CSV / Excel export of the filtered log. The export itself is logged first."""
    if file_type not in ("csv", "xlsx"):
        raise ValidationError(fields={"file_type": ["Choose csv or xlsx."]})
    logs = list(selectors.list_logs(**filters)[: EXPORT_LIMIT + 1])
    if len(logs) > EXPORT_LIMIT:
        raise ValidationError(
            fields={"occurred_from": [f"More than {EXPORT_LIMIT} entries: narrow the dates."]}
        )
    shown = {k: str(v) for k, v in filters.items() if v not in (None, "")}
    doc = Document(
        title="Audit log",
        filename_stem="audit-log",
        details=[f"Filters: {', '.join(f'{k}={v}' for k, v in shown.items())}"] if shown else [],
        tables=[
            Table(
                title="Entries",
                columns=[
                    "Time (UTC)",
                    "Event",
                    "Actor",
                    "Actor role",
                    "Target type",
                    "Target id",
                    "Before",
                    "After",
                    "Details",
                    "IP address",
                    "Request id",
                ],
                rows=[
                    [
                        log.occurred_at.strftime("%Y-%m-%d %H:%M:%S"),
                        log.event_type,
                        log.actor.get_full_name() if log.actor else "",
                        log.actor_role,
                        log.target_type,
                        log.target_id,
                        _json(log.before),
                        _json(log.after),
                        _json(log.metadata),
                        log.ip_address or "",
                        log.request_id,
                    ]
                    for log in logs
                ],
            )
        ],
    )
    content = render(doc, file_type)
    record(
        event_type=EXPORT_EVENT,
        actor=actor,
        metadata={"file_type": file_type, "filters": shown, "rows": len(logs)},
    )
    return doc.filename_stem, CONTENT_TYPES[file_type], content


def _json(value) -> str:
    return "" if value in (None, {}) else json.dumps(value, cls=DjangoJSONEncoder, sort_keys=True)


def purge_expired_logs(*, retention_days: int | None, now=None) -> int:
    """SET-03: purge audit log entries older than ``retention_days`` (NULL = keep forever).

    Uses ``models.QuerySet.delete`` because ``AuditLog`` is append-only during normal use.
    """
    if retention_days is None or retention_days <= 0:
        return 0
    cutoff = (now or timezone.now()) - timedelta(days=int(retention_days))
    qs = AuditLog.objects.filter(occurred_at__lt=cutoff)
    deleted, _ = models.QuerySet.delete(qs)
    return deleted


@transaction.atomic
def delete_logs(
    *, actor: Any, password: str, reason: str, pk: int | None = None, confirmation: str = ""
) -> int:
    """AUD-03 / ADR-022: explicit privileged exception, never ordinary ORM deletion."""
    if not getattr(actor, "is_authenticated", False) or not getattr(actor, "is_super_admin", False):
        raise PermissionDenied()
    # No setter: password verification must not modify an account owned by another module.
    if not check_password(password, actor.password):
        raise ValidationError(fields={"password": ["Your password is incorrect."]})
    reason = reason.strip()
    if not reason or len(reason) > 500:
        raise ValidationError(fields={"reason": ["Enter a reason of 1-500 characters."]})
    if pk is None and confirmation != CLEAR_CONFIRMATION:
        raise ValidationError(fields={"confirmation": [f"Type {CLEAR_CONFIRMATION} to confirm."]})

    entries = AuditLog.objects.all()
    if pk is not None:
        entry = entries.filter(pk=pk).first()
        if entry is None:
            raise NotFound()
        if entry.event_type in DELETION_EVENTS:
            raise BusinessRuleViolation("Deletion receipts cannot be removed manually.")
        entries = entries.filter(pk=pk)
    else:
        entries = entries.exclude(event_type__in=DELETION_EVENTS)

    deleted, _ = models.QuerySet.delete(entries)
    record(
        actor=actor,
        event_type=DELETION_EVENTS[0] if pk is not None else DELETION_EVENTS[1],
        target_type="audit.AuditLog",
        target_id=pk,
        metadata={"deleted_count": deleted, "reason": reason},
    )
    return deleted
