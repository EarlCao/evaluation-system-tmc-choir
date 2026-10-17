from dataclasses import dataclass
from typing import Any

from apps.core.events import DomainEvent


@dataclass(frozen=True, kw_only=True)
class SettingsChanged(DomainEvent):
    """``changes`` holds ``(field, before, after)`` tuples. Settings are configuration,
    not personal data, so their values may travel in the payload (ADR-014)."""

    name = "system.settings.changed"
    target_type = "system.SystemSettings"

    changes: tuple[tuple[str, Any, Any], ...]
