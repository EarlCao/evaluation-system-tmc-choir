"""Step 6.1: full permission-matrix sweep across every route and actor role/status.

Verifies (Roles and Permissions, Security Model, BR-04, NFR-03):
1. Every named route in the URL resolver is registered in the permission matrix.
2. Anonymous requests receive 401 on every member and admin endpoint, and succeed on public ones.
3. Pending, suspended and deactivated accounts receive 403 on every member and admin endpoint.
4. Active members receive 403 on every Super Admin endpoint (before any DB lookup, BR-04).
5. Another active member receives a generic 404 when probing someone else's evaluation or
   notification.
6. Super Admins are permitted on every admin endpoint.
"""

import uuid

import pytest
from django.urls import URLPattern, URLResolver, get_resolver, reverse
from rest_framework.test import APIClient

from apps.accounts.tests.factories import SuperAdminFactory, UserFactory
from apps.evaluations import services as evaluation_services
from apps.evaluations.tests.factories import make_criterion, make_cycle, make_form
from apps.members.tests.factories import MemberProfileFactory
from apps.notifications import services as notification_services
from apps.notifications.constants import NotificationType

pytestmark = pytest.mark.django_db


def _walk(patterns, namespace=None):
    for p in patterns:
        if isinstance(p, URLResolver):
            yield from _walk(p.url_patterns, p.namespace or namespace)
        elif isinstance(p, URLPattern) and p.name:
            yield namespace, f"{namespace}:{p.name}" if namespace else p.name


def all_api_routes() -> set[str]:
    return {name for ns, name in _walk(get_resolver().url_patterns) if ns != "admin"}


# Routes open to unauthenticated callers (AllowAny)
PUBLIC_ROUTES: dict[str, tuple[str, dict]] = {
    "core:health": ("get", {}),
    "accounts:csrf": ("get", {}),
    "accounts:login": ("post", {}),
    "accounts:password-reset": ("post", {}),
    "accounts:password-reset-confirm": ("post", {}),
    "accounts:verify-email": ("post", {}),
    "members:register": ("post", {}),
    "members:voice-sections": ("get", {}),
    "system:public": ("get", {}),
}

# Routes requiring IsActiveMember (any active account)
MEMBER_ROUTES: dict[str, str] = {
    "accounts:logout": "post",
    "accounts:me": "get",
    "accounts:password-change": "post",
    "accounts:deactivate": "post",
    "members:directory": "get",
    "members:me": "get",
    "members:detail": "get",
    "evaluations:current-cycle": "get",
    "evaluations:cycle-form": "get",
    "evaluations:submit": "post",
    "evaluations:eligibility": "get",
    "evaluations:mine": "get",
    "evaluations:mine-detail": "get",
    "evaluations:mine-revisions": "get",
    "feedback:received": "get",
    "feedback:summary": "get",
    "feedback:count": "get",
    "reports:dashboard": "get",
    "reports:my-export": "get",
    "notifications:list": "get",
    "notifications:unread-count": "get",
    "notifications:read-all": "post",
    "notifications:read": "post",
}

# Routes requiring IsSuperAdmin
ADMIN_ROUTES: dict[str, str] = {
    "schema": "get",
    "swagger-ui": "get",
    "members-admin:members": "get",
    "members-admin:member": "get",
    "members-admin:approve": "post",
    "members-admin:status": "post",
    "members-admin:role": "post",
    "members-admin:password-reset": "post",
    "members-admin:voice-sections": "get",
    "members-admin:voice-section": "patch",
    "evaluations-admin:categories": "get",
    "evaluations-admin:category": "patch",
    "evaluations-admin:criteria": "get",
    "evaluations-admin:criteria-reorder": "post",
    "evaluations-admin:criterion": "get",
    "evaluations-admin:criterion-archive": "post",
    "evaluations-admin:criterion-versions": "get",
    "evaluations-admin:comment-prompts": "get",
    "evaluations-admin:comment-prompts-reorder": "post",
    "evaluations-admin:comment-prompt": "get",
    "evaluations-admin:comment-prompt-archive": "post",
    "evaluations-admin:forms": "get",
    "evaluations-admin:form": "get",
    "evaluations-admin:form-publish": "post",
    "evaluations-admin:cycles": "get",
    "evaluations-admin:cycle": "get",
    "evaluations-admin:cycle-open": "post",
    "evaluations-admin:cycle-close": "post",
    "evaluations-admin:cycle-archive": "post",
    "evaluations-admin:evaluations": "get",
    "evaluations-admin:evaluation": "get",
    "evaluations-admin:evaluation-revisions": "get",
    "evaluations-admin:evaluation-moderate": "post",
    "evaluations-admin:moderation-queue": "get",
    "reports-admin:dashboard": "get",
    "reports-admin:choir": "get",
    "reports-admin:member": "get",
    "reports-admin:participation": "get",
    "reports-admin:export": "get",
    "audit-admin:logs": "get",
    "audit-admin:event-types": "get",
    "audit-admin:export": "get",
    "audit-admin:log": "get",
    "system-admin:settings": "get",
    "system-admin:backup-list": "get",
    "system-admin:backup-download": "get",
    "system-admin:backup-delete": "delete",
    "system-admin:backup-restore": "post",
    "system-admin:data-cleanup": "post",
}


@pytest.fixture
def matrix_world():
    super_admin = SuperAdminFactory()
    owner = MemberProfileFactory().user
    other_member = MemberProfileFactory().user
    recipient = MemberProfileFactory().user
    pending = UserFactory(pending=True)
    suspended = UserFactory(suspended=True)
    deactivated = UserFactory(deactivated=True)

    category = evaluation_services.create_category(actor=super_admin, name="Musicianship")
    criterion = make_criterion(super_admin, name="Pitch", category_id=category.pk)
    form = make_form(super_admin, criteria=[criterion])
    cycle = make_cycle(super_admin, form=form, open=True)
    cv_id = form.items.get().criterion_version_id

    evaluation = evaluation_services.submit_evaluation(
        evaluator=owner,
        recipient_public_id=recipient.public_id,
        ratings=[{"criterion_version": cv_id, "value": 4}],
        comment="Solid intonation.",
    )
    notif = notification_services.notify(
        recipient=owner,
        type=NotificationType.CYCLE_OPENED,
        message="Evaluation period is open.",
        link="/app/members",
    )

    def url_for(route_name: str) -> str:
        kwargs_by_route = {
            "members:detail": {"public_id": recipient.public_id},
            "evaluations:cycle-form": {"public_id": cycle.public_id},
            "evaluations:mine-detail": {"public_id": evaluation.public_id},
            "evaluations:mine-revisions": {"public_id": evaluation.public_id},
            "notifications:read": {"public_id": notif.public_id},
            "members-admin:member": {"public_id": owner.public_id},
            "members-admin:approve": {"public_id": pending.public_id},
            "members-admin:status": {"public_id": owner.public_id},
            "members-admin:role": {"public_id": owner.public_id},
            "members-admin:password-reset": {"public_id": owner.public_id},
            "members-admin:voice-section": {"pk": 1},
            "evaluations-admin:category": {"pk": criterion.category_id},
            "evaluations-admin:criterion": {"public_id": criterion.public_id},
            "evaluations-admin:criterion-archive": {"public_id": criterion.public_id},
            "evaluations-admin:criterion-versions": {"public_id": criterion.public_id},
            "evaluations-admin:comment-prompt": {"public_id": uuid.uuid4()},
            "evaluations-admin:comment-prompt-archive": {"public_id": uuid.uuid4()},
            "evaluations-admin:form": {"public_id": form.public_id},
            "evaluations-admin:form-publish": {"public_id": form.public_id},
            "evaluations-admin:cycle": {"public_id": cycle.public_id},
            "evaluations-admin:cycle-open": {"public_id": cycle.public_id},
            "evaluations-admin:cycle-close": {"public_id": cycle.public_id},
            "evaluations-admin:cycle-archive": {"public_id": cycle.public_id},
            "evaluations-admin:evaluation": {"public_id": evaluation.public_id},
            "evaluations-admin:evaluation-revisions": {"public_id": evaluation.public_id},
            "evaluations-admin:evaluation-moderate": {"public_id": evaluation.public_id},
            "reports-admin:member": {"public_id": recipient.public_id},
            "audit-admin:log": {"pk": 1},
            "system-admin:backup-download": {"filename": "missing.json.gz"},
            "system-admin:backup-delete": {"filename": "missing.json.gz"},
        }
        return reverse(route_name, kwargs=kwargs_by_route.get(route_name, {}))

    return {
        "super_admin": super_admin,
        "owner": owner,
        "other_member": other_member,
        "recipient": recipient,
        "pending": pending,
        "suspended": suspended,
        "deactivated": deactivated,
        "evaluation": evaluation,
        "notif": notif,
        "cycle": cycle,
        "url_for": url_for,
    }


def test_permission_matrix_covers_every_route():
    declared = set(PUBLIC_ROUTES) | set(MEMBER_ROUTES) | set(ADMIN_ROUTES)
    actual = all_api_routes()
    assert actual == declared, (
        f"Missing from matrix: {sorted(actual - declared)}; "
        f"stale in matrix: {sorted(declared - actual)}"
    )


@pytest.mark.parametrize("route_name", sorted(PUBLIC_ROUTES))
def test_public_routes_never_return_401_or_403_to_anonymous(matrix_world, route_name: str):
    method, payload = PUBLIC_ROUTES[route_name]
    client = APIClient()
    response = getattr(client, method)(matrix_world["url_for"](route_name), payload)
    assert response.status_code not in (401, 403), (route_name, response.status_code)


@pytest.mark.parametrize("route_name", sorted(set(MEMBER_ROUTES) | set(ADMIN_ROUTES)))
def test_anonymous_is_rejected_with_401_on_every_protected_route(matrix_world, route_name: str):
    method = MEMBER_ROUTES.get(route_name) or ADMIN_ROUTES[route_name]
    client = APIClient()
    response = getattr(client, method)(matrix_world["url_for"](route_name), {})
    assert response.status_code == 401, (route_name, method, response.status_code)


@pytest.mark.parametrize("status_role", ["pending", "suspended", "deactivated"])
@pytest.mark.parametrize("route_name", sorted(set(MEMBER_ROUTES) | set(ADMIN_ROUTES)))
def test_non_active_accounts_are_rejected_with_403_on_every_protected_route(
    matrix_world, status_role: str, route_name: str
):
    method = MEMBER_ROUTES.get(route_name) or ADMIN_ROUTES[route_name]
    client = APIClient()
    # Isolate the permission guard; real inactive Django sessions are dropped (accounts tests).
    client.force_authenticate(matrix_world[status_role])
    response = getattr(client, method)(matrix_world["url_for"](route_name), {})
    assert response.status_code == 403, (status_role, route_name, method, response.status_code)


@pytest.mark.parametrize("route_name", sorted(ADMIN_ROUTES))
def test_active_member_is_rejected_with_403_on_every_admin_route(matrix_world, route_name: str):
    method = ADMIN_ROUTES[route_name]
    client = APIClient()
    client.force_login(matrix_world["owner"])
    response = getattr(client, method)(matrix_world["url_for"](route_name), {})
    assert response.status_code == 403, (route_name, method, response.status_code)


@pytest.mark.parametrize("route_name", sorted(MEMBER_ROUTES))
def test_active_member_is_permitted_past_auth_guard_on_every_member_route(
    matrix_world, route_name: str
):
    method = MEMBER_ROUTES[route_name]
    client = APIClient()
    client.force_login(matrix_world["owner"])
    query = (
        {"recipient": str(matrix_world["recipient"].public_id)}
        if route_name == "evaluations:eligibility"
        else {}
    )
    response = getattr(client, method)(matrix_world["url_for"](route_name), query)
    assert response.status_code not in (401, 403), (route_name, method, response.status_code)


@pytest.mark.parametrize(
    ("route_name", "method"),
    [
        ("evaluations:mine-detail", "get"),
        ("evaluations:mine-detail", "patch"),
        ("evaluations:mine-revisions", "get"),
        ("notifications:read", "post"),
    ],
)
def test_other_member_cannot_access_or_mutate_anothers_private_records(
    matrix_world, route_name: str, method: str
):
    """BR-04 / Privacy Model §9: probing another member's evaluation or notification returns
    the exact same 404 as a non-existent UUID."""
    client = APIClient()
    client.force_login(matrix_world["other_member"])
    response = getattr(client, method)(matrix_world["url_for"](route_name), {})
    assert response.status_code == 404
    random_url = reverse(route_name, kwargs={"public_id": uuid.uuid4()})
    random_response = getattr(client, method)(random_url, {})
    assert random_response.status_code == 404
    assert response.json() == random_response.json()


@pytest.mark.parametrize("route_name", sorted(ADMIN_ROUTES))
def test_super_admin_is_permitted_past_auth_guard_on_every_admin_route(
    matrix_world, route_name: str
):
    method = ADMIN_ROUTES[route_name]
    client = APIClient()
    client.force_login(matrix_world["super_admin"])
    query = (
        {"cycle": str(matrix_world["cycle"].public_id)}
        if route_name == "reports-admin:participation"
        else {}
    )
    response = getattr(client, method)(matrix_world["url_for"](route_name), query)
    assert response.status_code not in (401, 403), (route_name, method, response.status_code)
