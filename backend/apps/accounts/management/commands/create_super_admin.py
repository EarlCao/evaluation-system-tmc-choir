import getpass
import os
import sys

from django.core.management.base import BaseCommand, CommandError

from apps.accounts import services
from apps.core.exceptions import DomainError

PASSWORD_ENV_VAR = "SUPER_ADMIN_PASSWORD"  # noqa: S105 (env var name, not a password)


class Command(BaseCommand):
    help = (
        "Create a Super Admin account. The password is read from the "
        f"{PASSWORD_ENV_VAR} environment variable, or prompted for interactively."
    )

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--username", required=True)
        parser.add_argument("--first-name", required=True)
        parser.add_argument("--last-name", required=True)

    def handle(self, *args, **options):
        password = os.environ.get(PASSWORD_ENV_VAR)
        if not password:
            if not sys.stdin.isatty():
                raise CommandError(f"Set {PASSWORD_ENV_VAR} when running non-interactively.")
            password = getpass.getpass("Password: ")
            if password != getpass.getpass("Password (again): "):
                raise CommandError("Passwords do not match.")
        try:
            user = services.create_super_admin(
                email=options["email"],
                username=options["username"],
                password=password,
                first_name=options["first_name"],
                last_name=options["last_name"],
            )
        except DomainError as exc:
            details = "; ".join(f"{k}: {' '.join(v)}" for k, v in (exc.fields or {}).items())
            raise CommandError(f"{exc.message} {details}".strip()) from exc
        self.stdout.write(self.style.SUCCESS(f"Super Admin '{user.username}' created."))
