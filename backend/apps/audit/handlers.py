"""Records every audited domain event (ADR-014). Registered in AuditConfig.ready()."""

import dataclasses

from apps.core.events import DomainEvent, subscribe

from . import services

_ENVELOPE_FIELDS = {"actor_id", "target_id", "changes"}


@subscribe(DomainEvent)
def record_domain_event(event: DomainEvent) -> None:
    if not event.audited:
        return

    payload = dataclasses.asdict(event)
    changes = payload.get("changes") or ()
    before = {field: old for field, old, _new in changes} if changes else None
    after = {field: new for field, _old, new in changes} if changes else None

    services.record(
        event_type=event.name,
        actor_id=event.actor_id,
        target_type=event.target_type,
        target_id=event.target_id,
        before=before,
        after=after,
        metadata={k: v for k, v in payload.items() if k not in _ENVELOPE_FIELDS},
    )
