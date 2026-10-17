from dataclasses import dataclass
from typing import Any

from apps.core.events import DomainEvent


@dataclass(frozen=True, kw_only=True)
class ProfileUpdated(DomainEvent):
    name = "members.profile.updated"
    target_type = "members.MemberProfile"
    changed_fields: tuple[str, ...]
    changes: tuple[tuple[str, Any, Any], ...] = ()


@dataclass(frozen=True, kw_only=True)
class VoiceSectionChanged(DomainEvent):
    name = "members.voice_section.changed"
    target_type = "members.VoiceSection"
    action: str
    changes: tuple[tuple[str, Any, Any], ...] = ()
