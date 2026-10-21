"""Domain events → notifications (Notifications module, RT-01..06). Registered in apps.py.

Privacy (RT-06, AGENT.md §3.7): member-facing text is generic. ``EvaluationSubmitted.actor_id``
is the evaluator and is never read here. Feedback notices are debounced/held (services).
"""

from apps.accounts import events as account_events
from apps.accounts import selectors as account_selectors
from apps.accounts.constants import UserRole, UserStatus
from apps.core.events import subscribe
from apps.evaluations import events as evaluation_events

from . import realtime, services
from .constants import NotificationType

AFTER_CLOSE = "AFTER_CLOSE"


@subscribe(evaluation_events.EvaluationSubmitted)
def on_evaluation_submitted(event: evaluation_events.EvaluationSubmitted) -> None:
    if event.actor_id == event.recipient_id:
        return
    services.queue_feedback_notice(
        recipient_id=event.recipient_id,
        cycle_id=event.cycle_id,
        after_close=event.feedback_visibility == AFTER_CLOSE,
    )
    realtime.dashboard_changed()


@subscribe(evaluation_events.CycleOpened)
def on_cycle_opened(event: evaluation_events.CycleOpened) -> None:
    services.notify_many(
        recipient_ids=account_selectors.active_user_ids(role=UserRole.MEMBER),
        type=NotificationType.CYCLE_OPENED,
        message=f"Evaluation period “{event.cycle_name}” is open.",
        link="/app/members",
    )
    realtime.dashboard_changed()


@subscribe(evaluation_events.CycleClosed)
def on_cycle_closed(event: evaluation_events.CycleClosed) -> None:
    services.notify_many(
        recipient_ids=account_selectors.active_user_ids(role=UserRole.MEMBER),
        type=NotificationType.CYCLE_CLOSED,
        message=f"Evaluation period “{event.cycle_name}” is closed.",
        link="/app/my-evaluations",
    )
    services.notify_many(
        recipient_ids=account_selectors.active_user_ids(role=UserRole.SUPER_ADMIN),
        type=NotificationType.CYCLE_COMPLETED,
        message=f"Evaluation period “{event.cycle_name}” has closed. See the participation report.",
        link="/admin/reports?view=participation",
    )
    if event.feedback_visibility == AFTER_CLOSE:
        services.release_cycle(cycle_id=event.cycle_id)
        services.deliver_due()
    realtime.dashboard_changed()


@subscribe(account_events.UserRegistered)
def on_user_registered(event: account_events.UserRegistered) -> None:
    user = account_selectors.get_user_by_pk(pk=event.target_id)
    if user is not None and user.status == UserStatus.PENDING and not user.email_verified_at:
        services.notify_many(
            recipient_ids=account_selectors.active_user_ids(role=UserRole.SUPER_ADMIN),
            type=NotificationType.REGISTRATION_PENDING,
            message="A new registration is waiting for approval.",
            link="/admin/members?status=PENDING",
        )
    realtime.dashboard_changed()


@subscribe(account_events.EmailVerified)
def on_email_verified(event: account_events.EmailVerified) -> None:
    user = account_selectors.get_user_by_pk(pk=event.target_id)
    if user is None or user.role != UserRole.MEMBER:
        return
    name = user.get_full_name() or user.username
    officer_label = ""
    if (
        hasattr(user, "member_profile")
        and user.member_profile.is_officer
        and user.member_profile.officer_position
    ):
        officer_label = f" ({user.member_profile.officer_position})"
    message = (
        f"{name} (@{user.username}){officer_label} has verified their OTP and created an account."
    )
    if len(message) > 200:
        message = f"{name} (@{user.username}) has verified their OTP and created an account."
    if len(message) > 200:
        message = f"{user.username} has verified their OTP and created an account."
    services.notify_many(
        recipient_ids=account_selectors.active_user_ids(role=UserRole.SUPER_ADMIN),
        type=NotificationType.MEMBER_REGISTERED,
        message=message,
        link=f"/admin/members/{user.public_id}",
    )
    realtime.dashboard_changed()


@subscribe(account_events.UserStatusChanged)
def on_user_status_changed(event: account_events.UserStatusChanged) -> None:
    before, after = next(((b, a) for f, b, a in event.changes if f == "status"), (None, None))
    user = account_selectors.get_user_by_pk(pk=event.target_id)
    if user is None:
        return
    if after == UserStatus.ACTIVE and before == UserStatus.PENDING:
        services.notify(
            recipient=user,
            type=NotificationType.ACCOUNT_APPROVED,
            message="Your account has been approved. Welcome!",
            link="/app",
        )
    elif after != UserStatus.ACTIVE:
        services.revoke_realtime(user=user)
    realtime.dashboard_changed()


@subscribe(account_events.LoginFailed)
def on_login_failed(event: account_events.LoginFailed) -> None:
    services.record_failed_login(identifier_hash=event.identifier_hash)
