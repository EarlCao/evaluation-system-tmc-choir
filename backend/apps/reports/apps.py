from django.apps import AppConfig


class ReportsConfig(AppConfig):
    """Read-only aggregates: dashboards, reports and exports (ADM-01, REP-*)."""

    name = "apps.reports"
    label = "reports"
    verbose_name = "Reports"
