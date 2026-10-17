"""Public read API of the reports module."""

from apps.members import selectors as member_selectors


def member_dashboard(*, user) -> dict:
    """Numbers for the member dashboard. Extended as evaluation features arrive
    (open cycle, evaluations to do: step 2.3; feedback received: step 3.2)."""
    profile = member_selectors.get_own_profile(user=user)
    return {
        "active_members": member_selectors.count_active_members(),
        "voice_section": profile.voice_section.name if profile else None,
    }
