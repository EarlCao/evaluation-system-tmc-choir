"""Public read API of the reports module."""

from apps.accounts import selectors as account_selectors
from apps.evaluations import selectors as evaluation_selectors
from apps.feedback import selectors as feedback_selectors
from apps.members import selectors as member_selectors


def member_dashboard(*, user) -> dict:
    """Numbers for the member dashboard."""
    profile = member_selectors.get_own_profile(user=user)
    cycle = evaluation_selectors.get_open_cycle()
    open_cycle = None
    if cycle is not None:
        open_cycle = {
            "public_id": cycle.public_id,
            "name": cycle.name,
            "ends_at": cycle.ends_at,
            "evaluations_given": evaluation_selectors.count_my_evaluations(user=user, cycle=cycle),
            "members_left": evaluation_selectors.count_members_left_to_evaluate(
                user=user, cycle=cycle
            ),
        }
    return {
        "active_members": member_selectors.count_active_members(),
        "voice_section": profile.voice_section.name if profile else None,
        "open_cycle": open_cycle,
        "feedback_received": feedback_selectors.count_received(recipient=user),
    }


def admin_dashboard() -> dict:
    """ADM-01: system-wide statistics for the Super Admin."""
    members = account_selectors.count_members_by_status()
    cycle = evaluation_selectors.get_open_cycle()
    open_cycle = None
    if cycle is not None:
        open_cycle = {
            "public_id": cycle.public_id,
            "name": cycle.name,
            "starts_at": cycle.starts_at,
            "ends_at": cycle.ends_at,
            "evaluation_scope": cycle.evaluation_scope,
            "evaluations_submitted": evaluation_selectors.count_submitted_evaluations(cycle=cycle),
            **evaluation_selectors.cycle_participation(cycle=cycle),
        }
    return {
        "members": {
            "registered": sum(members.values()),
            "active": members["ACTIVE"],
            "pending": members["PENDING"],
            "suspended": members["SUSPENDED"],
            "deactivated": members["DEACTIVATED"],
        },
        "evaluations_submitted": evaluation_selectors.count_submitted_evaluations(),
        "needs_moderation": evaluation_selectors.count_needing_moderation(),
        "cycles": evaluation_selectors.count_cycles_by_status(),
        "open_cycle": open_cycle,
    }
