"""Root URL configuration. Each module mounts its own ``api/urls.py`` under /api/v1/."""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("api/v1/", include("apps.core.api.urls")),
    path("api/v1/auth/", include("apps.accounts.api.urls")),
    path("api/v1/members/", include("apps.members.api.urls")),
    path("api/v1/", include("apps.reports.api.urls")),
    path("api/v1/", include("apps.evaluations.api.urls")),
    path("api/v1/system/", include("apps.system.api.urls")),
    # Super Admin endpoints (IsSuperAdmin on every view)
    path("api/v1/admin/", include("apps.evaluations.api.admin_urls")),
    # OpenAPI (dev: open; other environments: super admin only)
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    # Emergency-only Django admin, on a non-default path (Pages and Routes)
    path("django-admin/", admin.site.urls),
]
