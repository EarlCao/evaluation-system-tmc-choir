"""Step 5.2: events → safe notifications (RT-02, RT-03, RT-04, RT-06)."""

from datetime import timedelta

import pytest
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

from apps.accounts import services as account_services
from apps.accounts.tests.factories import SuperAdminFactory, UserFactory
from apps.evaluations import services as evaluation_services
from apps.evaluations.tests.factories import make_criterion, make_cycle, make_form
from apps.members import services as member_services
from apps.members.tests.factories import MemberProfileFactory, voice_section
from apps.notifications import services
from apps.notifications.constants import NotificationType
from apps.notifications.models import Notification, PendingFeedbackNotice
from apps.notifications.realtime import user_group
from apps.system import services as system_services

pytestmark = pytest.mark.django_db


@pytest.fixture
def run_events(django_capture_on_commit_callbacks):
    """Run a block and then its after-commit work (event handlers, pushes)."""

    def run(fn, *args, **kwargs):
        with django_capture_on_commit_callbacks(execute=True):
            return fn(*args, **kwargs)

    return run


@pytest.fixture
def setup(super_admin, run_events):
    form = make_form(super_admin, criteria=[make_criterion(super_admin)])
    return {"form": form, "cv": form.items.get().criterion_version_id}


def submit(run_events, setup, evaluator, recipient):
    return run_events(
        evaluation_services.submit_evaluation,
        evaluator=evaluator,
        recipient_public_id=recipient.public_id,
        ratings=[{"criterion_version": setup["cv"], "value": 4}],
        comment="Lovely tone.",
    )


def _feedback_notes(user):
    return Notification.objects.filter(recipient=user, type=NotificationType.FEEDBACK_AVAILABLE)


def test_feedback_notice_is_debounced_and_anonymous(setup, super_admin, run_events):
    run_events(make_cycle, super_admin, form=setup["form"], open=True)
    recipient = MemberProfileFactory().user
    alice, bob = MemberProfileFactory().user, MemberProfileFactory().user
    submit(run_events, setup, alice, recipient)
    submit(run_events, setup, bob, recipient)

    # Nothing at submission time (the timing would point at the evaluator).
    assert not _feedback_notes(recipient).exists()
    pending = PendingFeedbackNotice.objects.get(recipient=recipient)  # one window for both
    assert pending.deliver_after > timezone.now() + timedelta(minutes=59)
    assert services.deliver_due() == 0

    assert run_events(services.deliver_due, now=timezone.now() + timedelta(minutes=61)) == 1
    note = _feedback_notes(recipient).get()
    assert (note.message, note.link) == ("You have new feedback.", "/app/feedback")
    text = f"{note.message} {note.link}"
    for evaluator in (alice, bob):
        for identity in (evaluator.username, evaluator.first_name, str(evaluator.public_id)):
            assert identity not in text
    assert not PendingFeedbackNotice.objects.exists()


def test_no_debounce_delivers_after_commit_and_never_twice_while_unread(
    setup, super_admin, run_events
):
    run_events(
        system_services.update_settings,
        actor=super_admin,
        feedback_notification_debounce_minutes=0,
    )
    run_events(make_cycle, super_admin, form=setup["form"], open=True)
    recipient = MemberProfileFactory().user
    submit(run_events, setup, MemberProfileFactory().user, recipient)
    assert _feedback_notes(recipient).count() == 1
    submit(run_events, setup, MemberProfileFactory().user, recipient)
    assert _feedback_notes(recipient).count() == 1  # the first one is still unread


def test_after_close_feedback_waits_for_the_cycle_to_close(setup, super_admin, run_events):
    cycle = run_events(
        make_cycle, super_admin, form=setup["form"], open=True, feedback_visibility="AFTER_CLOSE"
    )
    recipient = MemberProfileFactory().user
    submit(run_events, setup, MemberProfileFactory().user, recipient)
    assert services.deliver_due(now=timezone.now() + timedelta(days=30)) == 0
    assert not _feedback_notes(recipient).exists()

    run_events(evaluation_services.close_cycle, actor=super_admin, cycle=cycle)
    assert _feedback_notes(recipient).count() == 1


def test_cycle_open_and_close_notify_active_members_and_admins(setup, super_admin, run_events):
    member = MemberProfileFactory().user
    suspended = MemberProfileFactory(user=UserFactory(suspended=True)).user
    cycle = run_events(make_cycle, super_admin, form=setup["form"], open=True, name="Spring")
    opened = Notification.objects.filter(type=NotificationType.CYCLE_OPENED)
    assert set(opened.values_list("recipient", flat=True)) == {member.pk}
    assert opened.get().message == "Evaluation period “Spring” is open."
    assert not Notification.objects.filter(recipient=suspended).exists()

    run_events(evaluation_services.close_cycle, actor=super_admin, cycle=cycle)
    assert Notification.objects.filter(
        recipient=member, type=NotificationType.CYCLE_CLOSED
    ).exists()
    assert Notification.objects.filter(
        recipient=super_admin, type=NotificationType.CYCLE_COMPLETED
    ).exists()


def test_registration_and_approval(super_admin, run_events):
    user = run_events(
        member_services.register_member,
        email="new@example.org",
        username="newbie",
        password="a-long-test-password-1",  # gitleaks:allow (fake test password)
        first_name="New",
        last_name="Member",
        voice_section_id=voice_section("Alto").pk,
    )
    pending = Notification.objects.get(type=NotificationType.REGISTRATION_PENDING)
    assert pending.recipient == super_admin
    assert "newbie" not in pending.message  # admins open the members page for details

    run_events(account_services.approve_user, actor=super_admin, user=user)
    approved = Notification.objects.get(recipient=user)
    assert approved.type == NotificationType.ACCOUNT_APPROVED


def test_repeated_failed_logins_alert_admins_once(super_admin):
    other_admin = SuperAdminFactory()
    results = [services.record_failed_login(identifier_hash="abc") for _ in range(12)]
    assert results.count(True) == 1
    assert results[9] is True  # the 10th failure
    alerts = Notification.objects.filter(type=NotificationType.UNUSUAL_ACTIVITY)
    assert set(alerts.values_list("recipient", flat=True)) == {super_admin.pk, other_admin.pk}


def test_realtime_payload_is_the_users_own_notification_only(setup, super_admin, run_events):
    run_events(make_cycle, super_admin, form=setup["form"], open=True)
    recipient = MemberProfileFactory().user
    evaluator = MemberProfileFactory(user__first_name="Evelyn").user
    layer = get_channel_layer()
    channel = async_to_sync(layer.new_channel)()
    async_to_sync(layer.group_add)(user_group(recipient.public_id), channel)

    submit(run_events, setup, evaluator, recipient)
    run_events(services.deliver_due, now=timezone.now() + timedelta(hours=2))
    message = async_to_sync(layer.receive)(channel)

    assert message["event"] == "notification.created"
    assert message["payload"]["unread"] == 1
    assert set(message["payload"]["notification"]) == {
        "public_id",
        "type",
        "message",
        "link",
        "is_read",
        "read_at",
        "created_at",
    }
    flat = repr(message)
    for identity in (evaluator.username, "Evelyn", str(evaluator.public_id)):
        assert identity not in flat


def test_suspension_revokes_open_sockets(member, super_admin, run_events):
    layer = get_channel_layer()
    channel = async_to_sync(layer.new_channel)()
    async_to_sync(layer.group_add)(user_group(member.public_id), channel)
    run_events(account_services.set_user_status, actor=super_admin, user=member, status="SUSPENDED")
    assert async_to_sync(layer.receive)(channel)["event"] == "session.revoked"
