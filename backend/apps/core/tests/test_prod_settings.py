"""Step 6.3: production settings, CSP header and `manage.py check --deploy` verification."""

import importlib
from pathlib import Path

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.core.management import call_command
from django.core.management.base import SystemCheckError
from django.test import override_settings
from django.urls import reverse

REPO_ROOT = Path(__file__).resolve().parents[4]


def _load_prod_module(monkeypatch, **env_overrides):
    defaults = {
        "DJANGO_SECRET_KEY": "prod-test-secret-key-at-least-fifty-characters-long-alpha",
        "FEEDBACK_ID_KEY": "prod-test-feedback-hmac-key-at-least-fifty-characters-bravo",
        "DJANGO_ALLOWED_HOSTS": "eval.choir.example.org",
        "CSRF_TRUSTED_ORIGINS": "https://eval.choir.example.org",
        "DATABASE_URL": "mysql://choir:pw@127.0.0.1:3307/choir_eval",
        "FRONTEND_URL": "https://eval.choir.example.org",
        "REDIS_URL": "redis://127.0.0.1:6380/0",
        "EMAIL_BACKEND": "django.core.mail.backends.smtp.EmailBackend",
    }
    defaults.update(env_overrides)
    for k, v in defaults.items():
        monkeypatch.setenv(k, v)
    import config.settings.base as base_settings

    importlib.reload(base_settings)
    import config.settings.prod as prod_settings

    return importlib.reload(prod_settings)


def test_prod_settings_flags_and_deploy_check_are_clean(monkeypatch):
    prod = _load_prod_module(monkeypatch)
    assert prod.DEBUG is False
    assert prod.SESSION_COOKIE_SECURE is True
    assert prod.SESSION_COOKIE_HTTPONLY is True
    assert prod.SESSION_COOKIE_SAMESITE == "Lax"
    assert prod.CSRF_COOKIE_SECURE is True
    assert prod.SECURE_SSL_REDIRECT is True
    assert prod.SECURE_HSTS_SECONDS >= 31536000
    assert prod.SECURE_HSTS_INCLUDE_SUBDOMAINS is True
    assert prod.SECURE_HSTS_PRELOAD is True
    assert prod.SECURE_CONTENT_TYPE_NOSNIFF is True
    assert prod.X_FRAME_OPTIONS == "DENY"
    assert "default-src 'self'" in prod.CONTENT_SECURITY_POLICY

    with override_settings(
        DEBUG=prod.DEBUG,
        SECRET_KEY=prod.SECRET_KEY,
        ALLOWED_HOSTS=prod.ALLOWED_HOSTS,
        SESSION_COOKIE_SECURE=prod.SESSION_COOKIE_SECURE,
        CSRF_COOKIE_SECURE=prod.CSRF_COOKIE_SECURE,
        SECURE_SSL_REDIRECT=prod.SECURE_SSL_REDIRECT,
        SECURE_HSTS_SECONDS=prod.SECURE_HSTS_SECONDS,
        SECURE_HSTS_INCLUDE_SUBDOMAINS=prod.SECURE_HSTS_INCLUDE_SUBDOMAINS,
        SECURE_HSTS_PRELOAD=prod.SECURE_HSTS_PRELOAD,
        SECURE_CONTENT_TYPE_NOSNIFF=prod.SECURE_CONTENT_TYPE_NOSNIFF,
        X_FRAME_OPTIONS=prod.X_FRAME_OPTIONS,
    ):
        # Fails with SystemCheckError if any deploy check warning or error exists
        try:
            call_command("check", "--deploy", fail_level="WARNING")
        except SystemCheckError as exc:  # pragma: no cover
            pytest.fail(f"manage.py check --deploy reported issues: {exc}")


@pytest.mark.parametrize(
    "bad_env",
    [
        {"DJANGO_ALLOWED_HOSTS": ""},
        {"DJANGO_ALLOWED_HOSTS": "*"},
        {"DJANGO_SECRET_KEY": "short"},  # gitleaks:allow
        {
            "DJANGO_SECRET_KEY": "change-me-please-replace-with-a-real-secret-value"
        },  # gitleaks:allow
        {
            "DJANGO_SECRET_KEY": "identical-thirty-two-character-secret-key-value-1234",
            "FEEDBACK_ID_KEY": "identical-thirty-two-character-secret-key-value-1234",
        },
    ],
)
def test_prod_settings_reject_weak_secrets_or_wildcard_hosts(monkeypatch, bad_env):
    with pytest.raises(ImproperlyConfigured):
        _load_prod_module(monkeypatch, **bad_env)


@pytest.mark.django_db
def test_content_security_policy_header_is_sent_when_configured(api_client):
    policy = "default-src 'self'; frame-ancestors 'none'"
    with override_settings(CONTENT_SECURITY_POLICY=policy):
        response = api_client.get(reverse("core:health"))
    assert response["Content-Security-Policy"] == policy


def test_production_deployment_artefacts_exist():
    for rel in (
        "deploy/backend.Dockerfile",
        "deploy/frontend.Dockerfile",
        "deploy/nginx/default.conf",
        "deploy/docker-compose.prod.yml",
    ):
        path = REPO_ROOT / rel
        assert path.is_file(), f"Missing {rel}"
    nginx_conf = (REPO_ROOT / "deploy/nginx/default.conf").read_text(encoding="utf-8")
    headers = (REPO_ROOT / "deploy/nginx/security-headers.conf").read_text(encoding="utf-8")
    assert "Content-Security-Policy" in headers
    assert "Strict-Transport-Security" in headers
    assert nginx_conf.count("include /etc/nginx/snippets/security-headers.conf;") == 4
    assert "location /ws/" in nginx_conf
    assert "location ~ ^/(api|django-admin)/" in nginx_conf
