"""Step 4.1: Super Admin dashboard statistics (ADM-01)."""

import pytest
from django.urls import reverse

from apps.accounts.tests.factories import SuperAdminFactory, UserFactory
from apps.evaluations import services
from apps.evaluations.tests.factories import make_criterion, make_cycle, make_form
from apps.members.tests.factories import MemberProfileFactory, voice_section
from apps.reports import selectors

pytestmark = pytest.mark.django_db

URL = reverse("reports-admin:dashboard")


def submit(evaluator, recipient, form):
    services.submit_evaluation(
        evaluator=evaluator,
        recipient_public_id=recipient.public_id,
        ratings=[{"criterion_version": form.items.get().criterion_version_id, "value": 4}],
    )


@pytest.fixture
def form(super_admin):
    return make_form(super_admin, criteria=[make_criterion(super_admin)])


def test_members_are_refused(member_client, api_client):
    assert member_client.get(URL).status_code == 403
    assert api_client.get(URL).status_code == 401


def test_member_counts_by_status():
    for _ in range(3):
        MemberProfileFactory()
    MemberProfileFactory(user=UserFactory(pending=True))
    MemberProfileFactory(user=UserFactory(suspended=True))
    SuperAdminFactory()  # not a member
    members = selectors.admin_dashboard()["members"]
    assert members == {"registered": 5, "active": 3, "pending": 1, "suspended": 1, "deactivated": 0}


def test_no_open_cycle(super_admin):
    data = selectors.admin_dashboard()
    assert data["open_cycle"] is None
    assert data["cycles"] == {"DRAFT": 0, "OPEN": 0, "CLOSED": 0, "ARCHIVED": 0}
    assert data["needs_moderation"] == 0


def test_participation_all_scope(super_admin, form):
    a, b, c = (MemberProfileFactory().user for _ in range(3))
    MemberProfileFactory(is_evaluable=False)  # conductor: evaluates, isn't evaluated
    make_cycle(super_admin, form=form, open=True)
    submit(a, b, form)
    submit(a, c, form)
    submit(b, c, form)
    cycle = selectors.admin_dashboard()["open_cycle"]
    # 4 evaluators x 3 evaluable recipients - 3 self pairs = 9 possible pairs
    assert cycle["possible_pairs"] == 9
    assert cycle["submitted_pairs"] == 3
    assert cycle["participating_members"] == 2
    assert cycle["participation_percent"] == pytest.approx(33.3)
    assert cycle["evaluations_submitted"] == 3

    from apps.evaluations import services
    from apps.evaluations.models import Evaluation

    services.moderate(
        actor=super_admin,
        evaluation=Evaluation.objects.first(),
        action="FLAG",
        target="EVALUATION",
        reason="Check",
    )
    assert selectors.admin_dashboard()["needs_moderation"] == 1


def test_participation_same_section(super_admin, form):
    tenors = [MemberProfileFactory(voice_section=voice_section("Tenor")).user for _ in range(3)]
    MemberProfileFactory(voice_section=voice_section("Bass"))
    MemberProfileFactory(voice_section=voice_section("Bass"))
    make_cycle(super_admin, form=form, open=True, evaluation_scope="SAME_SECTION")
    submit(tenors[0], tenors[1], form)
    cycle = selectors.admin_dashboard()["open_cycle"]
    assert cycle["possible_pairs"] == 3 * 3 - 3 + (2 * 2 - 2)  # tenors 6 + basses 2
    assert cycle["submitted_pairs"] == 1


def test_resubmissions_count_once(super_admin, form):
    a, b = MemberProfileFactory().user, MemberProfileFactory().user
    make_cycle(super_admin, form=form, open=True, allow_resubmission=True)
    submit(a, b, form)
    submit(a, b, form)
    cycle = selectors.admin_dashboard()["open_cycle"]
    assert (cycle["evaluations_submitted"], cycle["submitted_pairs"]) == (2, 1)


def test_dashboard_api(admin_client_api, super_admin, form):
    make_cycle(super_admin, form=form, open=True)
    make_cycle(super_admin, form=form)
    body = admin_client_api.get(URL).json()
    assert body["cycles"] == {"DRAFT": 1, "OPEN": 1, "CLOSED": 0, "ARCHIVED": 0}
    assert set(body["open_cycle"]) >= {"participation_percent", "possible_pairs", "name"}
    assert body["open_cycle"]["participation_percent"] is None  # no members yet → no fake 0 %
