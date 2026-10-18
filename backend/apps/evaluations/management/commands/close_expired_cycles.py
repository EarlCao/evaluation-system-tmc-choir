"""Close evaluation periods whose end date has passed (run every minute by the worker or cron)."""

from django.core.management.base import BaseCommand

from apps.evaluations import services


class Command(BaseCommand):
    help = "Close OPEN evaluation cycles whose ends_at has passed."

    def handle(self, *args, **options):
        closed = services.close_expired_cycles()
        if closed or options["verbosity"] > 1:
            names = ", ".join(c.name for c in closed) or "none"
            self.stdout.write(f"Closed {len(closed)} expired period(s): {names}.")
