"""Per-request context (request id, client IP, user agent) for audit logging."""

import ipaddress
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass

from django.conf import settings

USER_AGENT_MAX_LENGTH = 512


@dataclass(frozen=True)
class RequestContext:
    request_id: str
    ip_address: str | None
    user_agent: str


_current: ContextVar[RequestContext | None] = ContextVar("request_context", default=None)


def get_request_context() -> RequestContext | None:
    """Context of the request being handled, or ``None`` outside a request."""
    return _current.get()


@contextmanager
def request_context(context: RequestContext) -> Iterator[RequestContext]:
    """Set the context explicitly (tests, management commands, background jobs)."""
    token = _current.set(context)
    try:
        yield context
    finally:
        _current.reset(token)


def _valid_ip(value: str) -> str | None:
    try:
        return str(ipaddress.ip_address(value.strip()))
    except ValueError:
        return None


def client_ip(request) -> str | None:
    if settings.USE_X_FORWARDED_FOR:
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
        if forwarded:
            # Our reverse proxy appends the real client address last; earlier entries
            # are client-supplied and cannot be trusted.
            return _valid_ip(forwarded.split(",")[-1])
    return _valid_ip(request.META.get("REMOTE_ADDR", ""))


class RequestContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        context = RequestContext(
            request_id=uuid.uuid4().hex,
            ip_address=client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:USER_AGENT_MAX_LENGTH],
        )
        with request_context(context):
            response = self.get_response(request)
        response["X-Request-ID"] = context.request_id
        return response


class PrivateApiCacheMiddleware:
    """Privacy hardening (step 3.4): API responses hold personal data (feedback, profiles), so
    browsers and shared proxies must not store them. Views may still set their own policy."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith("/api/") and not response.has_header("Cache-Control"):
            response["Cache-Control"] = "no-store"
        csp = getattr(settings, "CONTENT_SECURITY_POLICY", "")
        if csp and not response.has_header("Content-Security-Policy"):
            response["Content-Security-Policy"] = csp
        return response
