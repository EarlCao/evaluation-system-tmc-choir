"""Purge evaluations and audit logs older than the configured retention windows (SET-03)."""

from django.core.management.base import BaseCommand

from apps.evaluations import services


class Command(BaseCommand):
    help = "Apply data-retention rules from SystemSettings (SET-03)."

    def handle(self, *args, **options):
        result = services.apply_retention()
        if (
            result["purged_evaluations"]
            or result["purged_audit_logs"]
            or options["verbosity"] > 1
        ):
            self.stdout.write(
                f"Retention applied: purged {result['purged_evaluations']} evaluation(s) "
                f"and {result['purged_audit_logs']} audit log entry/entries."
            )
