from rest_framework import authentication


def enforce_csrf(request) -> None:
    """Run Django's CSRF check on a DRF request, even for anonymous users.

    DRF's SessionAuthentication only checks CSRF for authenticated sessions; anonymous
    state-changing endpoints (login, register, password reset) call this explicitly.
    """
    authentication.SessionAuthentication().enforce_csrf(request)


class SessionAuthentication(authentication.SessionAuthentication):
    """Django session auth with CSRF enforcement (ADR-003).

    DRF's stock class has no ``WWW-Authenticate`` header, which makes unauthenticated
    requests answer 403. Providing one makes them answer 401, as API Conventions require.
    """

    def authenticate_header(self, request) -> str:
        return "Session"
