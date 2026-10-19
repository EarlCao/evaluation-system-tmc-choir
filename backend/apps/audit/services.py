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
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models
from django.utils import timezone

from apps.core.exceptions import ValidationError
from apps.core.exports import CONTENT_TYPES, Document, Table, render
from apps.core.middleware import get_request_context

from . import selectors
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


def delete_log(*, log: AuditLog) -> None:
    """Delete a single audit log entry (Super Admin action)."""
    models.QuerySet.delete(AuditLog.objects.filter(pk=log.pk))


def delete_logs(*, filters: dict | None = None) -> int:
    """Delete matching (or all) audit log entries (Super Admin action)."""
    has_filters = bool(filters and any(v not in (None, "") for v in filters.values()))
    if has_filters and filters is not None:
        ids = list(selectors.list_logs(**filters).values_list("id", flat=True))
        if not ids:
            return 0
        deleted, _ = models.QuerySet.delete(AuditLog.objects.filter(id__in=ids))
        return deleted
    deleted, _ = models.QuerySet.delete(AuditLog.objects.all())
    return deleted


