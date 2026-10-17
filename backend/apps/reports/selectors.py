"""Public read API of the reports module."""

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
