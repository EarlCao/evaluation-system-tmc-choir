"""drf-spectacular extensions (loaded in CoreConfig.ready)."""

from django.conf import settings
from drf_spectacular.extensions import OpenApiAuthenticationExtension


class SessionCookieScheme(OpenApiAuthenticationExtension):
    target_class = "apps.core.authentication.SessionAuthentication"
    name = "sessionCookie"

    def get_security_definition(self, auto_schema):
        return {"type": "apiKey", "in": "cookie", "name": settings.SESSION_COOKIE_NAME}
