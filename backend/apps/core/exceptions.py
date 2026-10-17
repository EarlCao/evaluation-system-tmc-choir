"""Domain errors and the global DRF exception handler.

Every API error uses one envelope (docs/06-API/API Conventions):

    {"error": {"code": "...", "message": "...", "fields": {...}}}

Messages are generic on purpose: they must never reveal other members' activity or
identities (Privacy Model).
"""

import logging

from django.conf import settings
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import exceptions as drf_exceptions
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler
from rest_framework.views import set_rollback

logger = logging.getLogger(__name__)


class DomainError(Exception):
    """Base class for errors raised by services and selectors."""

    status_code = status.HTTP_400_BAD_REQUEST
    code = "domain_error"
    default_message = "The request could not be completed."

    def __init__(self, message: str | None = None, *, fields: dict | None = None) -> None:
        self.message = message or self.default_message
        self.fields = fields
        super().__init__(self.message)


class ValidationError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "validation_error"
    default_message = "Please correct the highlighted fields."


class BusinessRuleViolation(DomainError):
    """A well-formed request that breaks a business rule (BR-xx). See ADR-012."""

    status_code = status.HTTP_409_CONFLICT
    code = "business_rule_violation"
    default_message = "This action is not allowed right now."


class PermissionDenied(DomainError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "permission_denied"
    default_message = "You do not have permission to perform this action."


class NotFound(DomainError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"
    default_message = "Not found."


# Order matters: subclasses before their bases.
_DRF_ERROR_CODES: list[tuple[type[Exception], str]] = [
    (drf_exceptions.ValidationError, "validation_error"),
    (drf_exceptions.ParseError, "parse_error"),
    (drf_exceptions.NotAuthenticated, "not_authenticated"),
    (drf_exceptions.AuthenticationFailed, "not_authenticated"),
    (drf_exceptions.PermissionDenied, "permission_denied"),
    (drf_exceptions.NotFound, "not_found"),
    (drf_exceptions.MethodNotAllowed, "method_not_allowed"),
    (drf_exceptions.NotAcceptable, "not_acceptable"),
    (drf_exceptions.UnsupportedMediaType, "unsupported_media_type"),
    (drf_exceptions.Throttled, "throttled"),
]


def error_body(code: str, message: str, fields: dict | None = None) -> dict:
    error: dict = {"code": code, "message": message}
    if fields:
        error["fields"] = fields
    return {"error": error}


def exception_handler(exc: Exception, context: dict) -> Response | None:
    if isinstance(exc, DomainError):
        set_rollback()
        return Response(error_body(exc.code, exc.message, exc.fields), status=exc.status_code)

    # Normalise Django-level errors to DRF ones with generic messages
    # (e.g. hide "No Evaluation matches the given query.").
    if isinstance(exc, Http404):
        exc = drf_exceptions.NotFound()
    elif isinstance(exc, DjangoPermissionDenied):
        exc = drf_exceptions.PermissionDenied()
    elif isinstance(exc, DjangoValidationError):
        detail = exc.message_dict if hasattr(exc, "error_dict") else exc.messages
        exc = drf_exceptions.ValidationError(detail=detail)

    response = drf_exception_handler(exc, context)
    if response is None:
        if settings.DEBUG:
            return None  # let Django render the traceback page
        logger.exception("Unhandled API error", exc_info=exc)
        set_rollback()
        return Response(
            error_body("server_error", "Something went wrong. Please try again later."),
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    code = next(
        (c for cls, c in _DRF_ERROR_CODES if isinstance(exc, cls)),
        getattr(exc, "default_code", "error"),
    )
    if isinstance(exc, drf_exceptions.ValidationError):
        data = response.data
        fields = data if isinstance(data, dict) else {"non_field_errors": data}
        response.data = error_body(code, ValidationError.default_message, fields)
    else:
        data = response.data
        message = str(data.get("detail", "")) if isinstance(data, dict) else str(data)
        response.data = error_body(code, message)
    return response
