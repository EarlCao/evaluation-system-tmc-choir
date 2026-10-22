"""AUTH-01/03: OTP delivery through the Brevo HTTPS API on Render Free."""

import json
import re
from unittest.mock import patch

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.core.mail import EmailMessage, send_mail

from apps.core.email_backend import BrevoEmailBackend


@pytest.fixture
def brevo(settings):
    settings.EMAIL_BACKEND = "apps.core.email_backend.BrevoEmailBackend"
    settings.BREVO_API_KEY = "test-brevo-key"
    settings.DEFAULT_FROM_EMAIL = "TMC Choir <sender@example.org>"
    settings.EMAIL_TIMEOUT = 8
    with patch("apps.core.email_backend.HTTPSConnection") as factory:
        connection = factory.return_value
        response = connection.getresponse.return_value
        response.status = 201
        response.read.return_value = b'{"messageId":"accepted-message"}'
        yield factory, connection, response


def test_brevo_send_mail_preserves_otp_and_uses_https(brevo):
    factory, connection, _ = brevo
    assert send_mail("Verify", "Code: 123456", None, ["singer@example.org"]) == 1
    factory.assert_called_once_with("api.brevo.com", timeout=8)
    call = connection.request.call_args
    assert call.args == ("POST", "/v3/smtp/email")
    assert call.kwargs["headers"]["api-key"] == "test-brevo-key"
    assert json.loads(call.kwargs["body"]) == {
        "sender": {"name": "TMC Choir", "email": "sender@example.org"},
        "to": [{"email": "singer@example.org"}],
        "subject": "Verify",
        "textContent": "Code: 123456",
    }
    connection.close.assert_called_once()


@pytest.mark.parametrize("status", [200, 301, 400, 401, 403, 429, 500])
def test_brevo_rejection_has_safe_diagnostics(brevo, status, caplog):
    _, connection, response = brevo
    response.status = status
    response.read.return_value = b'{"code":"unauthorized","message":"private-token-123456"}'
    with pytest.raises(OSError, match=f"Brevo delivery request failed \\(HTTP {status}\\)"):
        send_mail("Verify", "Code: 123456", None, ["private@example.org"])
    assert f"Brevo API delivery failed: endpoint=send_message status={status}" in caplog.text
    assert "reason=unauthorized" in caplog.text
    assert "private" not in caplog.text
    assert "123456" not in caplog.text
    connection.close.assert_called_once()


@pytest.mark.parametrize("body", [b"{}", b"invalid JSON", b"[]"])
def test_brevo_requires_confirmed_acceptance(brevo, body):
    _, connection, response = brevo
    response.read.return_value = body
    with pytest.raises((OSError, ValueError)):
        send_mail("Verify", "Code", None, ["singer@example.org"])
    connection.close.assert_called_once()


def test_brevo_missing_key_never_calls_network(brevo, settings):
    factory, _, _ = brevo
    settings.BREVO_API_KEY = ""
    with pytest.raises(ImproperlyConfigured, match="BREVO_API_KEY"):
        send_mail("Verify", "Code", None, ["singer@example.org"])
    factory.assert_not_called()


def test_brevo_timeout_and_fail_silently(brevo):
    _, connection, _ = brevo
    connection.request.side_effect = TimeoutError
    with pytest.raises(TimeoutError):
        send_mail("Verify", "Code", None, ["singer@example.org"])
    assert send_mail("Verify", "Code", None, ["singer@example.org"], fail_silently=True) == 0
    assert connection.close.call_count == 2


def test_brevo_empty_messages_do_not_call_network(brevo):
    factory, _, _ = brevo
    assert BrevoEmailBackend().send_messages([]) == 0
    assert EmailMessage("Empty", "Body").send() == 0
    factory.assert_not_called()


def test_brevo_cc_bcc_reply_to(brevo):
    _, connection, _ = brevo
    message = EmailMessage(
        "Verify",
        "Body",
        to=["singer@example.org"],
        cc=["cc@example.org"],
        bcc=["bcc@example.org"],
        reply_to=["reply@example.org"],
    )
    assert message.send() == 1
    payload = json.loads(connection.request.call_args.kwargs["body"])
    assert payload["cc"] == [{"email": "cc@example.org"}]
    assert payload["bcc"] == [{"email": "bcc@example.org"}]
    assert payload["replyTo"] == {"email": "reply@example.org"}


@pytest.mark.django_db
def test_registration_and_verification_with_brevo(brevo, registration_mode):
    from django.urls import reverse

    from apps.accounts.models import User
    from apps.members.tests.test_registration import csrf_client, payload

    registration_mode("APPROVAL")
    _, connection, _ = brevo
    client = csrf_client()
    data = payload()
    response = client.post(reverse("members:register"), data, HTTP_X_DEFER_ACCOUNT_CREATION="1")
    assert response.status_code == 201
    assert not User.objects.filter(email=data["email"]).exists()
    body = json.loads(connection.request.call_args.kwargs["body"])["textContent"]
    otp = re.search(r"verification code is: (\d{6})", body).group(1)
    response = client.post(reverse("accounts:verify-email"), {"email": data["email"], "otp": otp})
    assert response.status_code == 200
    user = User.objects.get(email=data["email"])
    assert user.email_verified_at is not None
    assert user.status == "PENDING"
    assert user.member_profile.voice_section_id == data["voice_section"]
