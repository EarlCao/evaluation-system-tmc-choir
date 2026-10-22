"""AUTH-01/03: OTP delivery over Gmail HTTPS without SMTP or secret logging."""

import base64
import json
from email import message_from_bytes
from unittest.mock import Mock, patch

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.core.mail import EmailMessage, send_mail

from apps.core.email_backend import GmailEmailBackend


@pytest.fixture
def gmail(settings):
    settings.EMAIL_BACKEND = "apps.core.email_backend.GmailEmailBackend"
    settings.GMAIL_CLIENT_ID = "test-client-id"
    settings.GMAIL_CLIENT_SECRET = "test-client-secret"
    settings.GMAIL_REFRESH_TOKEN = "test-refresh-token"
    settings.DEFAULT_FROM_EMAIL = "Choir <sender@gmail.com>"
    settings.EMAIL_TIMEOUT = 8
    with patch("apps.core.email_backend.HTTPSConnection") as factory:
        connection = factory.return_value
        token = Mock(status=200)
        token.read.return_value = b'{"access_token":"test-access-token"}'
        response = Mock(status=200)
        response.read.return_value = b'{"id":"accepted-message"}'
        connection.getresponse.side_effect = [token, response]
        yield factory, connection, token, response


def test_send_mail_refreshes_oauth_and_preserves_otp(gmail):
    factory, connection, _, _ = gmail
    assert send_mail("Verify", "Code: 123456", None, ["singer@example.org"]) == 1
    assert [c.args for c in factory.call_args_list] == [
        ("oauth2.googleapis.com",),
        ("gmail.googleapis.com",),
    ]
    assert all(c.kwargs["timeout"] == 8 for c in factory.call_args_list)
    token_call, send_call = connection.request.call_args_list
    assert token_call.args == ("POST", "/token")
    assert b"grant_type=refresh_token" in token_call.kwargs["body"]
    assert send_call.args == ("POST", "/gmail/v1/users/me/messages/send")
    assert send_call.kwargs["headers"]["Authorization"] == "Bearer test-access-token"
    raw = json.loads(send_call.kwargs["body"])["raw"]
    message = message_from_bytes(base64.urlsafe_b64decode(raw))
    assert message["To"] == "singer@example.org"
    assert message["From"] == "Choir <sender@gmail.com>"
    assert message["Subject"] == "Verify"
    assert message.get_payload(decode=True).decode().strip() == "Code: 123456"
    assert connection.close.call_count == 2


@pytest.mark.parametrize("status", [301, 400, 401, 403, 429, 500])
@pytest.mark.parametrize("phase", ["token", "send"])
def test_rejection_never_reports_success_or_leaks_response(gmail, status, phase, caplog):
    _, connection, token, response = gmail
    rejected = token if phase == "token" else response
    rejected.status = status
    rejected.read.return_value = b"private recipient and OTP"
    with pytest.raises(OSError, match=f"HTTP {status}") as error:
        send_mail("Verify", "Code: 123456", None, ["singer@example.org"])
    assert "private" not in str(error.value)
    assert "123456" not in caplog.text
    rejected.read.assert_not_called()
    assert connection.close.called


def test_timeout_propagates_and_closes_connection(gmail):
    _, connection, _, _ = gmail
    connection.request.side_effect = TimeoutError
    with pytest.raises(TimeoutError):
        send_mail("Verify", "Code", None, ["singer@example.org"])
    connection.close.assert_called_once()


def test_fail_silently_returns_zero(gmail):
    _, _, token, _ = gmail
    token.status = 400
    assert send_mail("Verify", "Code", None, ["singer@example.org"], fail_silently=True) == 0


@pytest.mark.parametrize("body", [b"{}", b"invalid JSON", b"[]"])
@pytest.mark.parametrize("phase", ["token", "send"])
def test_unconfirmed_acceptance_is_a_failure(gmail, body, phase):
    _, connection, token, response = gmail
    (token if phase == "token" else response).read.return_value = body
    with pytest.raises((OSError, ValueError)):
        send_mail("Verify", "Code", None, ["singer@example.org"])
    assert connection.close.called


@pytest.mark.parametrize("key", ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"])
def test_missing_credentials_fail_before_network(gmail, settings, key):
    factory, _, _, _ = gmail
    setattr(settings, key, "")
    with pytest.raises(ImproperlyConfigured, match="OAuth credentials"):
        send_mail("Verify", "Code", None, ["singer@example.org"])
    factory.assert_not_called()


def test_empty_messages_do_not_open_connection(gmail):
    factory, _, _, _ = gmail
    assert GmailEmailBackend().send_messages([]) == 0
    assert EmailMessage("No recipients", "Body").send() == 0
    factory.assert_not_called()


def test_batch_reuses_token_and_delivers_bcc(gmail):
    _, connection, token, response = gmail
    connection.getresponse.side_effect = [token, response, response]
    messages = [
        EmailMessage("Verify", "Code", to=["singer@example.org"], bcc=["hidden@example.org"])
        for _ in range(2)
    ]
    assert GmailEmailBackend().send_messages(messages) == 2
    assert connection.request.call_count == 3
    raw = json.loads(connection.request.call_args.kwargs["body"])["raw"]
    assert message_from_bytes(base64.urlsafe_b64decode(raw))["Bcc"] == "hidden@example.org"
