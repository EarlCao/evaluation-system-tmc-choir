from dataclasses import dataclass

import pytest
from django.db import transaction

from apps.core import events
from apps.core.events import DomainEvent, publish, subscribe


@dataclass(frozen=True, kw_only=True)
class ThingHappened(DomainEvent):
    name = "core_tests.thing.happened"
    thing_id: int


@dataclass(frozen=True, kw_only=True)
class OtherThingHappened(DomainEvent):
    name = "core_tests.other_thing.happened"


@pytest.fixture(autouse=True)
def _isolated_bus():
    with events.isolated_subscribers():
        yield


@pytest.mark.django_db
def test_event_is_dispatched_only_after_commit(django_capture_on_commit_callbacks):
    received = []
    subscribe(ThingHappened, received.append)

    with django_capture_on_commit_callbacks(execute=True):
        publish(ThingHappened(thing_id=1))
        assert received == []  # not before commit

    assert received == [ThingHappened(thing_id=1)]


@pytest.mark.django_db
def test_event_is_not_dispatched_when_transaction_rolls_back(django_capture_on_commit_callbacks):
    received = []
    subscribe(ThingHappened, received.append)

    with django_capture_on_commit_callbacks(execute=True):
        try:
            with transaction.atomic():
                publish(ThingHappened(thing_id=1))
                raise RuntimeError("boom")
        except RuntimeError:
            pass

    assert received == []


def test_handlers_only_receive_their_event_type():
    thing, other = [], []
    subscribe(ThingHappened, thing.append)
    subscribe(OtherThingHappened, other.append)

    events.dispatch(OtherThingHappened())

    assert thing == []
    assert other == [OtherThingHappened()]


def test_subscribing_to_base_class_receives_every_event():
    everything = []
    subscribe(DomainEvent, everything.append)

    events.dispatch(ThingHappened(thing_id=7))
    events.dispatch(OtherThingHappened())

    assert [e.name for e in everything] == [ThingHappened.name, OtherThingHappened.name]


def test_failing_handler_is_logged_and_does_not_stop_others(caplog):
    received = []

    def broken(event):
        raise ValueError("handler bug")

    subscribe(ThingHappened, broken)
    subscribe(ThingHappened, received.append)

    events.dispatch(ThingHappened(thing_id=3))

    assert received == [ThingHappened(thing_id=3)]
    assert "failed for event core_tests.thing.happened" in caplog.text


def test_subscribe_works_as_decorator_and_ignores_duplicates():
    calls = []

    @subscribe(ThingHappened)
    def handler(event):
        calls.append(event.thing_id)

    subscribe(ThingHappened, handler)  # duplicate registration is ignored
    events.dispatch(ThingHappened(thing_id=5))

    assert calls == [5]


def test_isolated_subscribers_restores_registry():
    marker = []
    subscribe(ThingHappened, marker.append)
    with events.isolated_subscribers():
        events.dispatch(ThingHappened(thing_id=1))
    events.dispatch(ThingHappened(thing_id=2))

    assert marker == [ThingHappened(thing_id=2)]
