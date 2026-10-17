from apps.core.throttles import ClientIPThrottle


class RegisterThrottle(ClientIPThrottle):
    scope = "register"
