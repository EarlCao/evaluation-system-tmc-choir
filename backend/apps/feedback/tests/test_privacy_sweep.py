"""Step 3.4: privacy hardening sweep (NFR-02, BR-03, BR-04, FB-05, Privacy Model).

Walks the URL resolver so that **every** member-facing endpoint is checked. Adding a new
member endpoint without registering it here fails ``test_sweep_covers_every_member_route``.
"""

import logging
import uuid

import pytest
from django.urls import URLPattern, URLResolver, get_resolver, reverse
from rest_framework.test import APIClient

from apps.core.testing.privacy import IDENTITY_KEYS, assert_no_evaluator_leak
from apps.evaluations import services
from apps.evaluations.constants import ModerationStatus
from apps.evaluations.models import Evaluation
from apps.evaluations.tests.factories import make_criterion, make_cycle, make_form
from apps.members.tests.factories import MemberProfileFactory

pytestmark = pytest.mark.django_db

ADMIN_NAMESPACES = {
    "evaluations-admin",
    "reports-admin",
    "members-admin",
    "audit-admin",
    "system-admin",
    "admin",
}
DOCS_ROUTES = {"schema", "swagger-ui"}

# Member-facing routes that only accept unsafe methods (no GET payload to sweep). Their
# responses are covered by module tests; they are listed so the completeness check is exact.
WRITE_ONLY = {
    "accounts:login",
    "accounts:logout",
    "accounts:password-change",
    "accounts:password-reset",
    "accounts:password-reset-confirm",
    "accounts:verify-email",
    "accounts:deactivate",
    "members:register",
    "evaluations:submit",
    "notifications:read",
    "notifications:read-all",
}

# Routes whose job is to show other members (directory, a profile, eligibility for one member).
# Names may legitimately appear there, so they get the identity-key check only.
KEY_ONLY = {"members:directory", "members:detail"}


def _walk(patterns, namespace=None):
    for p in patterns:
        if isinstance(p, URLResolver):
            yield from _walk(p.url_patterns, p.namespace or namespace)
        elif isinstance(p, URLPattern) and p.name:
            yield namespace, f"{namespace}:{p.name}" if namespace else p.name


def member_routes() -> set[str]:
    return {
        name
        for ns, name in _walk(get_resolver().url_patterns)
        if ns not in ADMIN_NAMESPACES and name not in DOCS_ROUTES
    }


def admin_routes() -> set[str]:
    return {
        name
        for ns, name in _walk(get_resolver().url_patterns)
        if ns in ADMIN_NAMESPACES - {"admin"}
    }


@pytest.fixture
def world(super_admin):
    """R (the recipient) was evaluated by E1..E4; one edited, one hidden by moderation.
    R also evaluated X (not one of R's evaluators), so R's own 'mine' pages have content."""
    form = make_form(super_admin, criteria=[make_criterion(super_admin, name="Attendance")])
    cycle = make_cycle(super_admin, form=form, open=True)
    cv = form.items.get().criterion_version_id
    recipient = MemberProfileFactory().user
    evaluators = [MemberProfileFactory().user for _ in range(4)]
    x = MemberProfileFactory().user

    def rate(evaluator, target, comment):
        return services.submit_evaluation(
            evaluator=evaluator,
            recipient_public_id=target.public_id,
            ratings=[{"criterion_version": cv, "value": 4}],
            comment=comment,
            suggestion="Keep practising the descant.",
        )

    received = [rate(ev, recipient, f"Comment number {i}") for i, ev in enumerate(evaluators)]
    services.edit_evaluation(
        editor=evaluators[0],
        evaluation_public_id=received[0].public_id,
        ratings=[{"criterion_version": cv, "value": 5}],
        comment="Edited comment",
    )
    Evaluation.objects.filter(pk=received[3].pk).update(moderation_status=ModerationStatus.HIDDEN)
    own = rate(recipient, x, "R's own evaluation of X")

    client = APIClient()
    client.force_login(recipient)
    return {
        "client": client,
        "recipient": recipient,
        "evaluators": evaluators,
        "cycle": cycle,
        "received": received,
        "own": own,
        "x": x,
    }


def _requests(world):
    """name → (kwargs, query) for every member GET route."""
    return {
        "core:health": ({}, {}),
        "accounts:csrf": ({}, {}),
        "accounts:me": ({}, {}),
        "members:directory": ({}, {}),
        "members:voice-sections": ({}, {}),
        "members:me": ({}, {}),
        "members:detail": ({"public_id": world["evaluators"][0].public_id}, {}),
        "evaluations:current-cycle": ({}, {}),
        "evaluations:cycle-form": ({"public_id": world["cycle"].public_id}, {}),
        "evaluations:eligibility": ({}, {"recipient": world["evaluators"][0].public_id}),
        "evaluations:mine": ({}, {}),
        "evaluations:mine-detail": ({"public_id": world["own"].public_id}, {}),
        "evaluations:mine-revisions": ({"public_id": world["own"].public_id}, {}),
        "feedback:received": ({}, {}),
        "feedback:summary": ({}, {}),
        "feedback:count": ({}, {}),
        "reports:dashboard": ({}, {}),
        "reports:my-export": ({}, {}),
        "system:public": ({}, {}),
        "notifications:list": ({}, {}),
        "notifications:unread-count": ({}, {}),
    }


def _keys(value):
    if isinstance(value, dict):
        for k, v in value.items():
            yield k
            yield from _keys(v)
    elif isinstance(value, list):
        for v in value:
            yield from _keys(v)


def test_sweep_covers_every_member_route(world):
    """Completeness: a new member endpoint must be added to the sweep (or WRITE_ONLY)."""
    swept = set(_requests(world)) | WRITE_ONLY
    assert member_routes() == swept, (
        f"unswept: {sorted(member_routes() - swept)}; stale: {sorted(swept - member_routes())}"
    )


def test_no_member_endpoint_reveals_who_evaluated_you(world):
    """NFR-02 / FB-05: the recipient calls every member GET endpoint; none of their four
    evaluators can be identified from any payload."""
    client, evaluators = world["client"], world["evaluators"]
    for name, (kwargs, query) in _requests(world).items():
        response = client.get(reverse(name, kwargs=kwargs), query)
        assert response.status_code == 200, (name, response.status_code)
        data = response.json()
        leaked_keys = IDENTITY_KEYS.intersection(_keys(data))
        assert not leaked_keys, f"{name} exposes identity keys {sorted(leaked_keys)}"
        if name not in KEY_ONLY:
            try:
                assert_no_evaluator_leak(data, *evaluators)
            except AssertionError as exc:  # pragma: no cover - message enrichment
                raise AssertionError(f"{name}: {exc}") from exc


def test_feedback_shows_current_text_only_and_hides_moderated(world):
    body = world["client"].get(reverse("feedback:received")).json()
    texts = {item["comment"] for item in body["results"]}
    assert texts == {"Edited comment", "Comment number 1", "Comment number 2"}  # #3 hidden
    assert "Comment number 0" not in str(body)  # the pre-edit text never reaches the recipient


def test_profile_of_an_evaluator_says_nothing_about_evaluating_you(world):
    body = (
        world["client"]
        .get(reverse("members:detail", kwargs={"public_id": world["evaluators"][0].public_id}))
        .json()
    )
    assert set(body) == {
        "public_id",
        "first_name",
        "last_name",
        "display_name",
        "voice_section",
        "bio",
        "joined_choir_on",
        "is_self",
    }


def test_probing_someone_elses_evaluation_is_a_generic_404(world):
    """Error messages never confirm another member's activity (Privacy Model §9)."""
    client = world["client"]
    about_me = world["received"][1].public_id  # written by E2 about R
    for name in ("evaluations:mine-detail", "evaluations:mine-revisions"):
        response = client.get(reverse(name, kwargs={"public_id": about_me}))
        assert response.status_code == 404
        assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}
    edit = client.patch(
        reverse("evaluations:mine-detail", kwargs={"public_id": about_me}), {"ratings": []}
    )
    assert edit.status_code == 404
    random = client.get(reverse("evaluations:mine-detail", kwargs={"public_id": uuid.uuid4()}))
    assert random.json() == edit.json() == {"error": {"code": "not_found", "message": "Not found."}}


def test_every_admin_route_is_closed_to_members(world):
    """BR-04: permission is checked before any lookup, so 403 never depends on existence."""
    client = world["client"]
    dummy = {"public_id": uuid.uuid4(), "pk": 1}
    for name in sorted(admin_routes()):
        pattern = next(p for ns, p in _walk(get_resolver().url_patterns) if p == name)
        kwargs = {}
        for key in ("public_id", "pk"):
            try:
                reverse(pattern, kwargs={key: dummy[key]})
                kwargs = {key: dummy[key]}
                break
            except Exception:  # noqa: S112 - route without that kwarg
                continue
        url = reverse(pattern, kwargs=kwargs)
        for method in ("get", "post", "patch"):
            status = getattr(client, method)(url, {}).status_code
            assert status in (403, 405), (name, method, status)


def test_django_admin_is_closed_to_members(world):
    response = world["client"].get("/django-admin/evaluations/evaluation/")
    assert response.status_code == 302
    assert "/django-admin/login/" in response["Location"]


def test_api_docs_are_closed_to_members(world):
    assert world["client"].get(reverse("schema")).status_code == 403


def test_api_responses_are_not_cacheable(world):
    """Private data must not be stored by browsers or shared proxies."""
    for name in ("feedback:received", "reports:dashboard", "accounts:me"):
        assert world["client"].get(reverse(name))["Cache-Control"] == "no-store"


def test_logs_never_contain_feedback_text_or_identities(super_admin, caplog):
    """Privacy Model §8: application logs don't carry comment text or evaluator/recipient pairs."""
    caplog.set_level(logging.DEBUG)
    form = make_form(super_admin, criteria=[make_criterion(super_admin)])
    make_cycle(super_admin, form=form, open=True)
    evaluator, recipient = MemberProfileFactory().user, MemberProfileFactory().user
    client = APIClient()
    client.force_login(evaluator)
    secret = "very-specific-secret-comment-q91"
    client.post(
        reverse("evaluations:submit"),
        {
            "recipient": str(recipient.public_id),
            "ratings": [{"criterion_version": form.items.get().criterion_version_id, "value": 3}],
            "comment": secret,
        },
        format="json",
    )
    other = APIClient()
    other.force_login(recipient)
    other.get(reverse("feedback:received"))
    text = caplog.text
    for needle in (secret, evaluator.username, evaluator.email, recipient.username):
        assert needle not in text
