import re

import pytest
from django.http import HttpResponse
from django.test import RequestFactory

from apps.core.middleware import RequestContextMiddleware, get_request_context

rf = RequestFactory()


def run(request):
    seen = {}

    def get_response(req):
        seen["context"] = get_request_context()
        return HttpResponse("ok")

    response = RequestContextMiddleware(get_response)(request)
    return response, seen["context"]


def test_context_available_during_request_and_cleared_after():
    request = rf.get("/", HTTP_USER_AGENT="pytest-agent", REMOTE_ADDR="192.0.2.10")
    response, context = run(request)

    assert context.ip_address == "192.0.2.10"
    assert context.user_agent == "pytest-agent"
    assert get_request_context() is None
    assert re.fullmatch(r"[0-9a-f]{32}", response["X-Request-ID"])
    assert response["X-Request-ID"] == context.request_id


def test_user_agent_is_truncated():
    _, context = run(rf.get("/", HTTP_USER_AGENT="a" * 2000))
    assert len(context.user_agent) == 512


def test_forwarded_for_ignored_unless_enabled(settings):
    settings.USE_X_FORWARDED_FOR = False
    _, context = run(rf.get("/", REMOTE_ADDR="10.0.0.1", HTTP_X_FORWARDED_FOR="203.0.113.5"))
    assert context.ip_address == "10.0.0.1"


@pytest.mark.parametrize(
    ("header", "expected"),
    [
        ("203.0.113.5", "203.0.113.5"),
        ("6.6.6.6, 203.0.113.5", "203.0.113.5"),  # spoofed first entry is ignored
        ("not-an-ip", None),
    ],
)
def test_forwarded_for_uses_last_hop_when_enabled(settings, header, expected):
    settings.USE_X_FORWARDED_FOR = True
    _, context = run(rf.get("/", REMOTE_ADDR="10.0.0.1", HTTP_X_FORWARDED_FOR=header))
    assert context.ip_address == expected
