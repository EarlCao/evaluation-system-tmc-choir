from django.core.cache import cache

from apps.core.throttles import ClientIPThrottle


class RegisterAttemptThrottle(ClientIPThrottle):
    """Bound rapid retries even when the email provider is unavailable."""

    scope = "register_attempt"


class RegisterThrottle(ClientIPThrottle):
    scope = "register"

    def get_cache_key(self, request, view):
        # Old counters include failed deliveries and must not carry into this policy.
        return super().get_cache_key(request, view) + "_delivery_v2"

    def throttle_success(self):
        result = super().throttle_success()
        self._reserved_at = self.now
        return result

    def refund_server_failure(self) -> None:
        """Remove only this request's reservation, preserving other registration history."""
        timestamp = getattr(self, "_reserved_at", None)
        if timestamp is None:
            return
        history = cache.get(self.key, [])
        if timestamp in history:
            history.remove(timestamp)
            cache.set(self.key, history, self.duration)
        self._reserved_at = None
