from dataclasses import dataclass

from apps.core.events import DomainEvent


@dataclass(frozen=True, kw_only=True)
class ProfileUpdated(DomainEvent):
    name = "members.profile.updated"
    target_type = "members.MemberProfile"
    changed_fields: tuple[str, ...]
