"""In-process domain event bus (ADR-002).

Services ``publish`` events; other modules ``subscribe`` handlers in their
``AppConfig.ready()``. Dispatch runs only after the surrounding transaction commits,
so handlers never act on rolled-back data. Payloads carry IDs only, never content or
names (Privacy Model).
"""

import logging
from collections import defaultdict
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import ClassVar

from django.db import transaction

logger = logging.getLogger(__name__)


@dataclass(frozen=True, kw_only=True)
class DomainEvent:
    """Base class for events. Subclasses are frozen dataclasses with a unique ``name``,
    formatted ``module.entity.past_tense_verb``.

    Envelope fields used by the audit module (ADR-014):
    - ``actor_id``: user who caused the event (``None`` = anonymous or system)
    - ``target_type`` / ``target_id``: the affected record
    - ``audited``: set ``False`` on a subclass for events that are not audit-relevant
    """

    name: ClassVar[str] = "core.event"
    target_type: ClassVar[str] = ""
    audited: ClassVar[bool] = True

    actor_id: int | None = None
    target_id: str | int | None = None


Handler = Callable[[DomainEvent], None]

_subscribers: defaultdict[type[DomainEvent], list[Handler]] = defaultdict(list)


def subscribe(event_cls: type[DomainEvent], handler: Handler | None = None):
    """Register ``handler`` for ``event_cls`` (and its subclasses). Usable as a decorator.

    Subscribing to ``DomainEvent`` itself receives every event (used by audit).
    """

    def register(fn: Handler) -> Handler:
        if fn not in _subscribers[event_cls]:
            _subscribers[event_cls].append(fn)
        return fn

    return register(handler) if handler is not None else register


def publish(event: DomainEvent, *, using: str | None = None) -> None:
    """Queue ``event`` for dispatch once the current transaction commits."""
    transaction.on_commit(lambda: dispatch(event), using=using)


def dispatch(event: DomainEvent) -> None:
    """Run every handler subscribed to the event's class or any of its base classes.

    A failing handler is logged and does not stop the others: the business write has
    already committed. Writes that must be atomic with the business change (e.g. some
    audit entries) call the owning service directly instead of relying on an event.
    """
    for cls in type(event).__mro__:
        for handler in list(_subscribers.get(cls, ())):
            try:
                handler(event)
            except Exception:
                logger.exception(
                    "Event handler %s failed for event %s",
                    getattr(handler, "__qualname__", repr(handler)),
                    event.name,
                )


@contextmanager
def isolated_subscribers() -> Iterator[None]:
    """Testing helper: run with an empty registry and restore the original afterwards."""
    saved = {cls: list(handlers) for cls, handlers in _subscribers.items()}
    _subscribers.clear()
    try:
        yield
    finally:
        _subscribers.clear()
        _subscribers.update(saved)
