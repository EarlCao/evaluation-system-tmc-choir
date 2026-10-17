import uuid

import pytest

from apps.core.models import AppendOnlyViolation
from apps.core.tests.testapp.models import LogEntry, Widget

pytestmark = pytest.mark.django_db


def test_timestamped_model_sets_created_and_updated_at():
    widget = Widget.objects.create(name="a")
    assert widget.created_at is not None
    first_updated = widget.updated_at

    widget.name = "b"
    widget.save()
    widget.refresh_from_db()
    assert widget.updated_at >= first_updated


def test_public_id_is_a_unique_uuid():
    a = Widget.objects.create(name="a")
    b = Widget.objects.create(name="b")
    assert isinstance(a.public_id, uuid.UUID)
    assert a.public_id != b.public_id


def test_append_only_allows_insert():
    LogEntry.objects.create(message="first")
    assert LogEntry.objects.count() == 1


def test_append_only_blocks_save_of_existing_row():
    entry = LogEntry.objects.create(message="first")
    entry.message = "changed"
    with pytest.raises(AppendOnlyViolation):
        entry.save()
    entry.refresh_from_db()
    assert entry.message == "first"


def test_append_only_blocks_instance_delete():
    entry = LogEntry.objects.create(message="first")
    with pytest.raises(AppendOnlyViolation):
        entry.delete()
    assert LogEntry.objects.filter(pk=entry.pk).exists()


@pytest.mark.parametrize(
    "operation",
    [
        lambda qs: qs.update(message="x"),
        lambda qs: qs.delete(),
        lambda qs: qs.bulk_update(list(qs), ["message"]),
    ],
    ids=["update", "delete", "bulk_update"],
)
def test_append_only_blocks_queryset_writes(operation):
    LogEntry.objects.create(message="first")
    with pytest.raises(AppendOnlyViolation):
        operation(LogEntry.objects.all())
    assert LogEntry.objects.get().message == "first"
