from rest_framework.throttling import UserRateThrottle


class ReportExportThrottle(UserRateThrottle):
    """Exports are heavy and identity-bearing: 60 per hour per Super Admin."""

    scope = "report_export"
