"""Abuse protection (Security Model). Rates live in REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]."""

import hashlib

from rest_framework.throttling import SimpleRateThrottle

from apps.core.throttles import ClientIPThrottle


class LoginThrottle(SimpleRateThrottle):
    """5/min per IP + identifier: slows guessing on one account without letting one
    client lock out everybody else behind the same IP."""

    scope = "login"

    def get_cache_key(self, request, view):
        identifier = str(request.data.get("identifier", "")).strip().lower()
        digest = hashlib.sha256(identifier.encode()).hexdigest()[:16]
        ident = f"{self.get_ident(request)}:{digest}"
        return self.cache_format % {"scope": self.scope, "ident": ident}


class PasswordResetThrottle(ClientIPThrottle):
    scope = "password_reset"
