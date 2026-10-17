from django.apps import AppConfig


class AccountsConfig(AppConfig):
    """Identity, credentials, roles, account status (AUTH-01..06)."""

    name = "apps.accounts"
    label = "accounts"
    verbose_name = "Accounts"
