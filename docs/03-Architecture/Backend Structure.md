---
tags: [architecture, backend]
---
# Backend Structure

```
backend/
├── manage.py
├── pyproject.toml              # ruff, pytest (DJANGO_SETTINGS_MODULE=config.settings.test)
├── requirements/
│   ├── base.txt                # pinned runtime deps
│   ├── dev.txt                 # -r base.txt + pytest, factory-boy, ruff, ...
│   └── prod.txt                # -r base.txt + production server deps
├── config/
│   ├── settings/
│   │   ├── base.py             # shared; reads env via django-environ
│   │   ├── dev.py              # DEBUG, console email backend
│   │   ├── test.py             # fast hasher, eager events, test DB
│   │   └── prod.py             # HTTPS, secure cookies, HSTS, logging
│   ├── urls.py                 # /api/v1/<module>/ includes, /api/schema/, /django-admin/
│   ├── routing.py              # websocket_urlpatterns (Phase 5)
│   ├── asgi.py                 # ProtocolTypeRouter(http, websocket)
│   └── wsgi.py
└── apps/
    ├── core/
    ├── system/
    ├── accounts/
    ├── members/
    ├── evaluations/
    ├── feedback/
    ├── reports/
    ├── audit/
    └── notifications/
```

## Standard module shape
Each `apps/<module>/` follows the layout fixed in `AGENT.md` §2.2:

| File | Role | Public? |
|---|---|---|
| `models.py` | ORM models owned by this module | private (others may FK to them) |
| `selectors.py` | Read functions: `get_*`, `list_*`. They return querysets or DTOs, already permission-scoped | ✅ public |
| `services.py` | Write use-cases: validate rules, `transaction.atomic()`, publish events | ✅ public |
| `events.py` | Event names + payload dataclasses this module publishes | ✅ public |
| `constants.py` | `TextChoices` enums, limits | ✅ public |
| `handlers.py` | Subscribers to other modules' events, registered in `AppConfig.ready()` | private |
| `permissions.py` | DRF permission classes specific to this module | private |
| `api/serializers.py` | Member-facing serializers (explicit field whitelists) | private |
| `api/admin_serializers.py` | Super-admin serializers (may include identities) | private |
| `api/views.py`, `api/admin_views.py` | Thin DRF views | private |
| `api/urls.py` | Member-facing routes, mounted in `config/urls.py` | private |
| `api/admin_urls.py` | Super Admin routes, mounted under `/api/v1/admin/` | private |
| `tests/` | factories + tests per layer | – |

## Example: the shape of a service
```python
# apps/evaluations/services.py
from django.db import transaction
from apps.core.events import publish
from apps.core.exceptions import BusinessRuleViolation
from . import events
from .models import Evaluation

def submit_evaluation(*, evaluator: User, recipient: User, cycle: EvaluationCycle,
                      ratings: list[RatingInput], comment: str, suggestion: str) -> Evaluation:
    """EVAL-01, EVAL-07, EVAL-08, BR-01, BR-12, BR-13, BR-14"""
    if evaluator.pk == recipient.pk:
        raise BusinessRuleViolation("You cannot evaluate yourself.")
    check_eligibility(evaluator=evaluator, recipient=recipient, cycle=cycle)
    with transaction.atomic():
        evaluation = Evaluation.objects.create(...)
        _write_ratings(evaluation, ratings)
        _write_revision(evaluation, editor=evaluator, summary="Created")
        publish(events.EvaluationSubmitted(evaluation_id=evaluation.pk,
                                           recipient_id=recipient.pk, cycle_id=cycle.pk))
    return evaluation
```

## `core` shared kernel (contents)
- `models.py`: `TimeStampedModel`, `PublicIdModel` (UUID), `AppendOnlyModel` (blocks update/delete)
- `events.py`: `DomainEvent` (frozen dataclass base), `publish(event)`,
  `subscribe(event_cls, handler)` (also a decorator; subscribing to `DomainEvent` receives
  every event). Dispatch runs via `transaction.on_commit`, and a failing handler is logged
  without stopping the others. Tests use pytest-django's
  `django_capture_on_commit_callbacks(execute=True)` and `events.isolated_subscribers()`.
- `exceptions.py`: domain errors + DRF exception handler → error envelope
- `authentication.py`: `SessionAuthentication` (DRF session auth + CSRF that answers **401**, not 403, when unauthenticated)
- `permissions.py`: `IsActiveMember` (the DRF default), `IsSuperAdmin`. They rely on the
  `user.is_active_member` / `user.is_super_admin` properties that `accounts.User` must provide
- `pagination.py`: `DefaultPagination` (page number, `page_size` ≤ 100)
- `throttles.py`: `ClientIPThrottle` base (scoped, keyed by client IP)
- `schema.py`: drf-spectacular extension documenting the session-cookie auth
- `authentication.enforce_csrf(request)`: CSRF check for anonymous state-changing views
- `api/views.py` `HealthView`: `GET /api/v1/health/`
- `testing/privacy.py`: `assert_no_evaluator_leak(payload, *evaluators)`
- `middleware.py`: `RequestContextMiddleware` (contextvar with request_id, IP, user agent; adds an `X-Request-ID` header). Use `get_request_context()`

## URL mounting
```
/api/v1/health/                 core
/api/v1/auth/...                accounts
/api/v1/members/...             members
/api/v1/evaluation-cycles/...   evaluations
/api/v1/evaluations/...         evaluations
/api/v1/feedback/...            feedback
/api/v1/notifications/...       notifications
/api/v1/system/...              system (public privacy notice, settings)
/api/v1/admin/...               admin_views of every module (IsSuperAdmin)
/api/schema/ , /api/docs/       drf-spectacular (dev + super admin only in prod)
/ws/notifications/              notifications consumer (Phase 5)
/ws/admin/                      admin live dashboard consumer (Phase 5)
```

Related: [[Module Boundaries]] · [[API Endpoints]] · [[Data Model]]
