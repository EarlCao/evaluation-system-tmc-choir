"""Deliver due "new feedback" notices. Run every minute (cron, or the compose ``worker``):

python manage.py deliver_notifications            # once
python manage.py deliver_notifications --loop 60  # forever, every 60 s
"""

import time

from django.core.management.base import BaseCommand

from apps.notifications import services


class Command(BaseCommand):
    help = "Turn due pending feedback notices into notifications."

    def add_arguments(self, parser):
        parser.add_argument("--loop", type=int, default=0, help="Repeat every N seconds.")

    def handle(self, *args, loop: int = 0, **options):
        while True:
            delivered = services.deliver_due()
            if delivered or not loop:
                self.stdout.write(f"Delivered {delivered} feedback notification(s).")
            if not loop:
                return
            time.sleep(loop)
