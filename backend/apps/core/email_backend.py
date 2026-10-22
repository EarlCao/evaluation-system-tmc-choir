"""Send transactional email through Gmail or Brevo HTTPS APIs on Render Free."""

import base64
import json
import logging
from email.utils import parseaddr
from http.client import HTTPSConnection
from urllib.parse import urlencode

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)

# Only recognized provider codes may enter logs; never log free-text error messages.
_SAFE_REASONS = frozenset(
    {
        "invalid_grant",
        "invalid_client",
        "unauthorized_client",
        "invalid_request",
        "access_denied",
        "accessNotConfigured",
        "insufficientPermissions",
        "authError",
        "forbidden",
        "dailyLimitExceeded",
        "rateLimitExceeded",
        "userRateLimitExceeded",
        "failedPrecondition",
        "badRequest",
        "quotaExceeded",
        "domainPolicy",
        "SERVICE_DISABLED",
        "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
        "UNAUTHENTICATED",
        "PERMISSION_DENIED",
        "RESOURCE_EXHAUSTED",
        "unauthorized",
        "permission_denied",
        "invalid_parameter",
        "missing_parameter",
        "not_enough_credits",
    }
)


def _failure_reason(response) -> str:
    try:
        data = json.loads(response.read(16384))
        error = data.get("error") if isinstance(data, dict) else None
        candidates = [error] if isinstance(error, str) else []
        if isinstance(data, dict):
            candidates.append(data.get("code"))
        if isinstance(error, dict):
            for field in ("errors", "details"):
                entries = error.get(field)
                if isinstance(entries, list):
                    candidates.extend(e.get("reason") for e in entries if isinstance(e, dict))
            candidates.append(error.get("status"))
        for reason in candidates:
            if isinstance(reason, str) and reason in _SAFE_REASONS:
                return reason
    except (OSError, ValueError):
        pass
    return "unknown"


def _post(*, host: str, path: str, body: bytes, headers: dict, success_status: int = 200) -> dict:
    # Fixed HTTPS hosts, no redirects, and no response bodies in errors or logs.
    connection = HTTPSConnection(host, timeout=settings.EMAIL_TIMEOUT)
    try:
        connection.request("POST", path, body=body, headers=headers)
        response = connection.getresponse()
        provider = "Brevo" if host == "api.brevo.com" else "Gmail"
        if response.status != success_status:
            logger.error(
                "%s API delivery failed: endpoint=%s status=%s reason=%s",
                provider,
                "oauth_token" if host == "oauth2.googleapis.com" else "send_message",
                response.status,
                _failure_reason(response),
            )
            raise OSError(f"{provider} delivery request failed (HTTP {response.status}).")
        result = json.loads(response.read())
        if not isinstance(result, dict):
            raise OSError(f"{provider} returned an invalid response.")
        return result
    finally:
        connection.close()


class GmailEmailBackend(BaseEmailBackend):
    """Refresh the sender's OAuth token, then submit Django MIME messages over HTTPS."""

    def send_messages(self, email_messages) -> int:
        sent = 0
        access_token = None
        for message in email_messages or []:
            if not message.recipients():
                continue
            try:
                if not access_token:
                    if not all(
                        (
                            settings.GMAIL_CLIENT_ID,
                            settings.GMAIL_CLIENT_SECRET,
                            settings.GMAIL_REFRESH_TOKEN,
                        )
                    ):
                        raise ImproperlyConfigured("Gmail API OAuth credentials are required.")
                    result = _post(
                        host="oauth2.googleapis.com",
                        path="/token",
                        body=urlencode(
                            {
                                "client_id": settings.GMAIL_CLIENT_ID,
                                "client_secret": settings.GMAIL_CLIENT_SECRET,
                                "refresh_token": settings.GMAIL_REFRESH_TOKEN,
                                "grant_type": "refresh_token",
                            }
                        ).encode("utf-8"),
                        headers={"Content-Type": "application/x-www-form-urlencoded"},
                    )
                    access_token = result.get("access_token")
                    if not access_token:
                        raise OSError("Gmail did not authorize email delivery.")
                mime_message = message.message()
                # Django omits Bcc from MIME. Gmail needs it to deliver hidden recipients.
                if message.bcc:
                    mime_message["Bcc"] = ", ".join(message.bcc)
                raw = base64.urlsafe_b64encode(mime_message.as_bytes()).decode("ascii")
                result = _post(
                    host="gmail.googleapis.com",
                    path="/gmail/v1/users/me/messages/send",
                    body=json.dumps({"raw": raw}).encode("utf-8"),
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                    },
                )
                if not result.get("id"):
                    raise OSError("Gmail did not accept the message.")
                sent += 1
            except Exception:
                if not self.fail_silently:
                    raise
        return sent


def _address(value: str) -> dict[str, str]:
    name, email = parseaddr(value)
    return {"email": email, **({"name": name} if name else {})}


class BrevoEmailBackend(BaseEmailBackend):
    """Deliver the application's plain-text verification/reset emails over HTTPS."""

    def send_messages(self, email_messages) -> int:
        sent = 0
        for message in email_messages or []:
            if not message.recipients():
                continue
            try:
                if not settings.BREVO_API_KEY:
                    raise ImproperlyConfigured("BREVO_API_KEY is required for email delivery.")
                if message.attachments or getattr(message, "alternatives", None):
                    raise ValueError("Brevo backend does not support attachments or alternatives.")
                payload = {
                    "sender": _address(message.from_email),
                    "subject": message.subject,
                    "htmlContent" if message.content_subtype == "html" else "textContent": (
                        message.body
                    ),
                }
                for field in ("to", "cc", "bcc"):
                    if addresses := getattr(message, field):
                        payload[field] = [_address(address) for address in addresses]
                if message.reply_to:
                    payload["replyTo"] = _address(message.reply_to[0])
                result = _post(
                    host="api.brevo.com",
                    path="/v3/smtp/email",
                    body=json.dumps(payload).encode("utf-8"),
                    headers={
                        "api-key": settings.BREVO_API_KEY,
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                    success_status=201,
                )
                if not result.get("messageId"):
                    raise OSError("Brevo did not accept the message.")
                sent += 1
            except Exception:
                if not self.fail_silently:
                    raise
        return sent
