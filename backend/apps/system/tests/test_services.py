import pytest

from apps.core import events
from apps.core.exceptions import ValidationError
from apps.system import selectors, services
from apps.system.constants import RegistrationMode
from apps.system.events import SettingsChanged
from apps.system.models import SystemSettings

pytestmark = pytest.mark.django_db


@pytest.fixture
def published():
    received = []
    with events.isolated_subscribers():
        events.subscribe(SettingsChanged, received.append)
        yield received


def test_update_settings_saves_and_publishes_event(
    actor, published, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True):
        result = services.update_settings(
            actor=actor, choir_name="St. Cecilia Choir", registration_mode=RegistrationMode.OPEN
        )

    saved = SystemSettings.objects.get()
    assert saved.choir_name == "St. Cecilia Choir"
    assert saved.registration_mode == RegistrationMode.OPEN
    assert saved.updated_by == actor
    assert result.pk == saved.pk
    assert published == [
        SettingsChanged(
            actor_id=actor.pk,
            target_id=1,
            changes=(
                ("choir_name", "", "St. Cecilia Choir"),
                ("registration_mode", RegistrationMode.APPROVAL, RegistrationMode.OPEN),
            ),
        )
    ]


def test_cache_is_invalidated_after_commit(actor, django_capture_on_commit_callbacks):
    assert selectors.get_settings().system_name == "Choir Member Evaluation System"
    with django_capture_on_commit_callbacks(execute=True):
        services.update_settings(actor=actor, system_name="Choir Eval")
    assert selectors.get_settings().system_name == "Choir Eval"


def test_raw_input_is_coerced_to_field_types(actor, published, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        services.update_settings(actor=actor, min_aggregate_group_size="5")
    assert SystemSettings.objects.get().min_aggregate_group_size == 5
    assert published[0].changes == (("min_aggregate_group_size", 3, 5),)


def test_unchanged_values_do_not_publish(actor, published, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        services.update_settings(actor=actor, time_zone="UTC")
    assert published == []


@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"updated_by": None}, "updated_by"),  # not editable
        ({"pk": 2}, "pk"),
        ({"min_aggregate_group_size": 2}, "min_aggregate_group_size"),  # ADR-013
        ({"min_aggregate_group_size": "abc"}, "min_aggregate_group_size"),
        ({"time_zone": "Nowhere/Land"}, "time_zone"),
    ],
)
def test_invalid_changes_are_rejected_and_nothing_is_saved(
    actor, published, changes, field, django_capture_on_commit_callbacks
):
    SystemSettings.load()
    with django_capture_on_commit_callbacks(execute=True), pytest.raises(ValidationError) as exc:
        services.update_settings(actor=actor, **changes)
    assert field in exc.value.fields
    assert SystemSettings.objects.get().min_aggregate_group_size == 3
    assert published == []
