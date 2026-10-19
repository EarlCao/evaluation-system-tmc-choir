"""Public write API of the system module."""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction

from apps.core.events import publish
from apps.core.exceptions import ValidationError

from .events import SettingsChanged
from .models import SINGLETON_PK, SystemSettings
from .selectors import invalidate_settings_cache

EDITABLE_FIELDS = frozenset(
    {
        "system_name",
        "choir_name",
        "choir_description",
        "time_zone",
        "registration_mode",
        "min_aggregate_group_size",
        "min_comment_prompts",
        "feedback_notification_debounce_minutes",
        "privacy_notice",
        "retention_evaluations_days",
        "retention_revisions_days",
        "retention_audit_days",
    }
)


def _to_python(changes: dict) -> dict:
    """Coerce raw input (e.g. "5") to field types so diffs and audit values are exact."""
    converted, errors = {}, {}
    for field, value in changes.items():
        try:
            converted[field] = SystemSettings._meta.get_field(field).to_python(value)
        except DjangoValidationError as exc:
            errors[field] = exc.messages
    if errors:
        raise ValidationError(fields=errors)
    return converted


def update_settings(*, actor, **changes) -> SystemSettings:
    """SET-01: change system settings. Validates, saves, invalidates the cache after
    commit and publishes ``system.settings.changed`` (audited, BR-08)."""
    unknown = sorted(set(changes) - EDITABLE_FIELDS)
    if unknown:
        raise ValidationError(
            fields={field: ["This setting cannot be changed."] for field in unknown}
        )

    changes = _to_python(changes)

    with transaction.atomic():
        SystemSettings.load()  # make sure the singleton row exists
        settings_obj = SystemSettings.objects.select_for_update().get(pk=SINGLETON_PK)
        diff = tuple(
            (field, getattr(settings_obj, field), value)
            for field, value in sorted(changes.items())
            if getattr(settings_obj, field) != value
        )
        if not diff:
            return settings_obj

        for field, _before, after in diff:
            setattr(settings_obj, field, after)
        settings_obj.updated_by = actor
        try:
            settings_obj.full_clean()
        except DjangoValidationError as exc:
            raise ValidationError(fields=exc.message_dict) from exc
        settings_obj.save()

        transaction.on_commit(invalidate_settings_cache)
        publish(
            SettingsChanged(
                actor_id=getattr(actor, "pk", None), target_id=SINGLETON_PK, changes=diff
            )
        )
    return settings_obj
