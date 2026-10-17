"""The global exception handler produces the API Conventions error envelope."""

from types import SimpleNamespace

import pytest
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import exceptions as drf_exceptions
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.views import APIView

from apps.core import exceptions
from apps.core.permissions import IsActiveMember

factory = APIRequestFactory()


def raising_view(exc: Exception):
    class View(APIView):
        permission_classes = [AllowAny]

        def get(self, request):
            raise exc

    return View.as_view()


def call(view, user=None):
    request = factory.get("/x/")
    if user is not None:
        force_authenticate(request, user=user)
    response = view(request)
    response.render()
    return response


@pytest.mark.parametrize(
    ("exc", "status", "code"),
    [
        (exceptions.ValidationError(fields={"comment": ["Required."]}), 400, "validation_error"),
        (
            exceptions.BusinessRuleViolation("You cannot evaluate yourself."),
            409,
            "business_rule_violation",
        ),
        (exceptions.PermissionDenied(), 403, "permission_denied"),
        (exceptions.NotFound(), 404, "not_found"),
    ],
)
def test_domain_errors_map_to_envelope(exc, status, code):
    response = call(raising_view(exc))
    assert response.status_code == status
    assert response.data["error"]["code"] == code
    assert response.data["error"]["message"] == exc.message


def test_domain_error_fields_are_included():
    exc = exceptions.ValidationError(fields={"comment": ["Required."]})
    response = call(raising_view(exc))
    assert response.data == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": {"comment": ["Required."]},
        }
    }


def test_drf_validation_error_dict_becomes_fields():
    response = call(raising_view(drf_exceptions.ValidationError({"email": ["Invalid."]})))
    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert response.data["error"]["fields"] == {"email": ["Invalid."]}


def test_drf_validation_error_list_becomes_non_field_errors():
    response = call(raising_view(drf_exceptions.ValidationError(["Bad input."])))
    assert response.data["error"]["fields"] == {"non_field_errors": ["Bad input."]}


def test_django_validation_error_is_converted():
    response = call(raising_view(DjangoValidationError({"name": ["Too long."]})))
    assert response.status_code == 400
    assert response.data["error"]["fields"] == {"name": ["Too long."]}


def test_http404_uses_generic_message():
    response = call(raising_view(Http404("No Evaluation matches the given query.")))
    assert response.status_code == 404
    assert response.data == {"error": {"code": "not_found", "message": "Not found."}}


def test_django_permission_denied_is_converted():
    response = call(raising_view(DjangoPermissionDenied("secret reason")))
    assert response.status_code == 403
    assert response.data["error"]["code"] == "permission_denied"
    assert "secret reason" not in response.data["error"]["message"]


def test_throttled_keeps_retry_after_header():
    response = call(raising_view(drf_exceptions.Throttled(wait=5)))
    assert response.status_code == 429
    assert response.data["error"]["code"] == "throttled"
    assert response["Retry-After"] == "5"


def test_unexpected_error_returns_generic_500_when_not_debug(settings):
    settings.DEBUG = False
    response = call(raising_view(RuntimeError("database password is hunter2")))
    assert response.status_code == 500
    assert response.data == {
        "error": {
            "code": "server_error",
            "message": "Something went wrong. Please try again later.",
        }
    }


class MembersOnlyView(APIView):
    permission_classes = [IsActiveMember]

    def get(self, request):
        return Response({"ok": True})


def test_unauthenticated_request_is_401_with_session_auth():
    response = call(MembersOnlyView.as_view())
    assert response.status_code == 401
    assert response.data["error"]["code"] == "not_authenticated"
    assert response["WWW-Authenticate"] == "Session"


def test_authenticated_but_inactive_user_is_403():
    user = SimpleNamespace(is_authenticated=True, is_active_member=False)
    response = call(MembersOnlyView.as_view(), user=user)
    assert response.status_code == 403
    assert response.data["error"]["code"] == "permission_denied"
