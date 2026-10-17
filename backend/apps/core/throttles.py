from rest_framework.throttling import SimpleRateThrottle


class ClientIPThrottle(SimpleRateThrottle):
    """Scoped throttle keyed by client IP (DRF ``get_ident``, proxy-aware via NUM_PROXIES).
    Subclasses set ``scope``; rates live in REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]."""

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}
