"""Configuration services: criteria versions, forms, cycles (EVAL-02..06, CFG-*, BR-07/13/18)."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.core.exceptions import BusinessRuleViolation, ValidationError
from apps.core.models import AppendOnlyViolation
from apps.evaluations import selectors, services
from apps.evaluations.constants import CycleStatus, FormStatus
from apps.evaluations.models import CriterionVersion, EvaluationCycle
from apps.evaluations.tests.factories import make_criterion, make_cycle, make_form

pytestmark = pytest.mark.django_db


# --------------------------------------------------------------------------- criteria
def test_create_criterion_creates_version_one(actor):
    criterion = make_criterion(actor, name="Attendance", labels={"1": "Poor", "5": "Excellent"})
    version = criterion.current_version
    assert version.version == 1
    assert version.name == "Attendance"
    assert version.labels == {"1": "Poor", "5": "Excellent"}
    assert criterion.key == "attendance"
    assert version.created_by == actor


def test_duplicate_names_get_unique_keys(actor):
    first, second = make_criterion(actor, name="Teamwork"), make_criterion(actor, name="Teamwork")
    assert first.key == "teamwork"
    assert second.key == "teamwork-2"


def test_invalid_scale_is_rejected(actor):
    with pytest.raises(ValidationError) as exc:
        make_criterion(actor, min_value=5, max_value=1)
    assert "max_value" in exc.value.fields


def test_editing_wording_or_scale_creates_a_new_version(actor):
    """BR-07: old versions stay untouched for historical evaluations."""
    criterion = make_criterion(actor, name="Prep")
    v1 = criterion.current_version
    services.update_criterion(actor=actor, criterion=criterion, name="Preparation", max_value=10)
    criterion.refresh_from_db()
    v1.refresh_from_db()
    assert criterion.current_version.version == 2
    assert criterion.current_version.name == "Preparation"
    assert criterion.current_version.max_value == Decimal(10)
    assert (v1.name, v1.max_value) == ("Prep", Decimal(5))


def test_unchanged_values_do_not_create_versions(actor):
    criterion = make_criterion(actor, name="Same")
    services.update_criterion(actor=actor, criterion=criterion, name="Same", max_value="5.00")
    assert criterion.versions.count() == 1


def test_active_flag_changes_in_place(actor):
    criterion = make_criterion(actor)
    services.update_criterion(actor=actor, criterion=criterion, is_active=False)
    criterion.refresh_from_db()
    assert criterion.is_active is False
    assert criterion.versions.count() == 1


def test_criterion_versions_are_immutable(actor):
    version = make_criterion(actor).current_version
    version.name = "tampered"
    with pytest.raises(AppendOnlyViolation):
        version.save()
    with pytest.raises(AppendOnlyViolation):
        CriterionVersion.objects.filter(pk=version.pk).update(name="tampered")


def test_archived_criteria_cannot_change(actor):
    criterion = services.archive_criterion(actor=actor, criterion=make_criterion(actor))
    assert criterion.is_archived
    assert not criterion.is_active
    with pytest.raises(BusinessRuleViolation):
        services.update_criterion(actor=actor, criterion=criterion, name="Again")


def test_reorder_requires_every_criterion_once(actor):
    a, b, c = make_criterion(actor), make_criterion(actor), make_criterion(actor)
    services.reorder_criteria(
        actor=actor, ordered_public_ids=[str(c.public_id), str(a.public_id), str(b.public_id)]
    )
    assert [x.pk for x in selectors.list_criteria()] == [c.pk, a.pk, b.pk]
    with pytest.raises(ValidationError):
        services.reorder_criteria(actor=actor, ordered_public_ids=[str(a.public_id)])


def test_criterion_changes_are_audited(actor, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        criterion = make_criterion(actor, name="Tone")
        services.update_criterion(actor=actor, criterion=criterion, name="Tone quality")
    entries = AuditLog.objects.filter(event_type="evaluations.criterion.changed").order_by("id")
    assert [e.metadata["action"] for e in entries] == ["created", "updated"]
    assert entries.last().after == {"name": "Tone quality"}
    assert entries.last().actor == actor


# --------------------------------------------------------------------------- forms
def test_publish_freezes_current_versions(actor):
    """CFG-06 / BR-18."""
    criterion = make_criterion(actor, name="Blend")
    form = make_form(actor, criteria=[criterion], publish=False)
    services.update_criterion(actor=actor, criterion=criterion, name="Blend & balance")  # v2
    services.publish_form_version(actor=actor, form=form)
    item = form.items.get()
    assert item.criterion_version.name == "Blend & balance"  # draft refreshed at publish

    services.update_criterion(actor=actor, criterion=criterion, name="Something else")  # v3
    assert form.items.get().criterion_version.version == 2  # published form keeps v2


def test_published_forms_cannot_change(actor):
    form = make_form(actor)
    assert form.status == FormStatus.PUBLISHED
    with pytest.raises(BusinessRuleViolation):
        services.update_form_version(actor=actor, form=form, title="New")
    with pytest.raises(BusinessRuleViolation):
        services.publish_form_version(actor=actor, form=form)
    form.title = "Direct edit"
    with pytest.raises(DjangoValidationError):
        form.save()


def test_forms_need_active_unique_criteria(actor):
    archived = services.archive_criterion(actor=actor, criterion=make_criterion(actor))
    ok = make_criterion(actor)
    with pytest.raises(ValidationError):
        services.create_form_version(actor=actor, title="F", criteria=[])
    with pytest.raises(ValidationError):
        services.create_form_version(actor=actor, title="F", criteria=[str(archived.public_id)])
    with pytest.raises(ValidationError):
        services.create_form_version(
            actor=actor, title="F", criteria=[str(ok.public_id), str(ok.public_id)]
        )


def test_form_versions_number_sequentially(actor):
    assert [make_form(actor).version, make_form(actor).version] == [1, 2]


def test_text_limits_are_validated(actor):
    with pytest.raises(ValidationError) as exc:
        make_form(actor, comment_max_length=0)
    assert "comment_max_length" in exc.value.fields


# --------------------------------------------------------------------------- cycles
def test_cycle_lifecycle(actor, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        cycle = make_cycle(actor)
        assert cycle.status == CycleStatus.DRAFT
        assert cycle.edit_deadline == cycle.ends_at  # default
        cycle = services.open_cycle(actor=actor, cycle=cycle)
        assert (cycle.status, cycle.is_current) == (CycleStatus.OPEN, True)
        assert selectors.get_open_cycle() == cycle
        cycle = services.close_cycle(actor=actor, cycle=cycle)
        assert (cycle.status, cycle.is_current) == (CycleStatus.CLOSED, None)
        cycle = services.archive_cycle(actor=actor, cycle=cycle)
    assert cycle.status == CycleStatus.ARCHIVED
    events = list(
        AuditLog.objects.filter(target_id=str(cycle.public_id)).values_list("event_type", flat=True)
    )
    assert "evaluations.cycle.opened" in events
    assert "evaluations.cycle.closed" in events


def test_only_one_cycle_can_be_open(actor):
    make_cycle(actor, open=True)
    with pytest.raises(BusinessRuleViolation, match="already open"):
        make_cycle(actor, open=True)


def test_database_enforces_a_single_open_cycle(actor):
    first, second = make_cycle(actor, open=True), make_cycle(actor)
    with pytest.raises(IntegrityError):
        EvaluationCycle.objects.filter(pk=second.pk).update(
            status=CycleStatus.OPEN, is_current=True
        )
    assert first.is_current is True


def test_open_requires_a_published_form_and_future_end(actor):
    draft_form = make_form(actor, publish=False)
    with pytest.raises(ValidationError):
        make_cycle(actor, form=draft_form)
    no_form = services.create_cycle(
        actor=actor,
        name="No form",
        starts_at=timezone.now(),
        ends_at=timezone.now() + timedelta(days=1),
    )
    with pytest.raises(BusinessRuleViolation, match="form"):
        services.open_cycle(actor=actor, cycle=no_form)
    past = make_cycle(
        actor,
        starts_at=timezone.now() - timedelta(days=10),
        ends_at=timezone.now() - timedelta(days=1),
    )
    with pytest.raises(BusinessRuleViolation, match="ended"):
        services.open_cycle(actor=actor, cycle=past)


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"ends_at_offset": -2}, "ends_at"),
        ({"edit_offset": -5}, "edit_deadline"),
        ({"evaluation_scope": "EVERYONE"}, "evaluation_scope"),
        ({"name": "  "}, "name"),
    ],
)
def test_cycle_validation(actor, overrides, field):
    now = timezone.now()
    kwargs = {
        "name": overrides.get("name", "C"),
        "starts_at": now,
        "ends_at": now + timedelta(days=1),
    }
    if "ends_at_offset" in overrides:
        kwargs["ends_at"] = now + timedelta(days=overrides["ends_at_offset"])
    if "edit_offset" in overrides:
        kwargs["edit_deadline"] = now + timedelta(days=overrides["edit_offset"])
    if "evaluation_scope" in overrides:
        kwargs["evaluation_scope"] = overrides["evaluation_scope"]
    with pytest.raises(ValidationError) as exc:
        services.create_cycle(actor=actor, **kwargs)
    assert field in exc.value.fields


def test_open_cycle_settings_are_locked(actor):
    cycle = make_cycle(actor, open=True)
    services.update_cycle(actor=actor, cycle=cycle, ends_at=cycle.ends_at + timedelta(days=3))
    with pytest.raises(BusinessRuleViolation, match="evaluation_scope"):
        services.update_cycle(actor=actor, cycle=cycle, evaluation_scope="SAME_SECTION")


@pytest.mark.parametrize("action", ["close_cycle", "archive_cycle"])
def test_invalid_transitions(actor, action):
    with pytest.raises(BusinessRuleViolation):
        getattr(services, action)(actor=actor, cycle=make_cycle(actor))
