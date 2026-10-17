"""Public read API of the audit module (AUD-04). Super Admin only; callers enforce that."""

from datetime import date

from django.db.models import Q, QuerySet

from apps.core.exceptions import NotFound

from .models import AuditLog


def list_logs(
    *,
    search: str = "",
    event_type: str = "",
    actor: str = "",
    target_type: str = "",
    target_id: str = "",
    occurred_from: date | None = None,
    occurred_to: date | None = None,
) -> QuerySet[AuditLog]:
    """Newest first. ``event_type`` ending in ``.`` or ``*`` matches a prefix
    (``evaluations.`` = every evaluations event). ``actor`` is a user public id.
    ``search`` matches event type, target id, IP address or request id."""
    qs = AuditLog.objects.select_related("actor")
    if event_type.endswith((".", "*")):
        qs = qs.filter(event_type__startswith=event_type.rstrip("*"))
    elif event_type:
        qs = qs.filter(event_type=event_type)
    if actor:
        qs = qs.filter(actor__public_id=actor)
    if target_type:
        qs = qs.filter(target_type=target_type)
    if target_id:
        qs = qs.filter(target_id=target_id)
    if occurred_from:
        qs = qs.filter(occurred_at__date__gte=occurred_from)
    if occurred_to:
        qs = qs.filter(occurred_at__date__lte=occurred_to)
    for term in search.split():
        qs = qs.filter(
            Q(event_type__icontains=term)
            | Q(target_id__icontains=term)
            | Q(ip_address__startswith=term)
            | Q(request_id=term)
        )
    return qs.order_by("-occurred_at", "-id")


def get_log(*, pk: int) -> AuditLog:
    log = AuditLog.objects.select_related("actor").filter(pk=pk).first()
    if log is None:
        raise NotFound()
    return log


def list_event_types() -> list[str]:
    """Every event type recorded so far (for the filter list)."""
    return list(
        AuditLog.objects.order_by("event_type").values_list("event_type", flat=True).distinct()
    )
