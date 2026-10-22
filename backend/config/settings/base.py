"""Shared settings. Environment-specific modules (dev/test/prod) import from here.

All configuration comes from environment variables (django-environ). In development
they are read from the repository-root ``.env`` file; see ``.env.example``.
"""

import atexit
import tempfile
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/
REPO_ROOT = BASE_DIR.parent

env = environ.Env()
# Real environment variables take precedence over values in .env.
environ.Env.read_env(REPO_ROOT / ".env", overwrite=False)

# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------
SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=CSRF_TRUSTED_ORIGINS)

# HMAC key for opaque feedback IDs (Privacy Model). Must differ from SECRET_KEY.
FEEDBACK_ID_KEY = env("FEEDBACK_ID_KEY")

# Public URL of the SPA, used to build links in emails (password reset).
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:5280")

# Only trust X-Forwarded-For when running behind our own reverse proxy (prod).
USE_X_FORWARDED_FOR = env.bool("USE_X_FORWARDED_FOR", default=False)

INSTALLED_APPS = [
    # daphne first: `runserver` then serves the ASGI app (HTTP + WebSockets).
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third party
    "rest_framework",
    "django_filters",
    "drf_spectacular",
    "channels",
    # project modules (see AGENT.md §2)
    "apps.core",
    "apps.system",
    "apps.audit",
    "apps.accounts",
    "apps.members",
    "apps.evaluations",
    "apps.feedback",
    "apps.reports",
    "apps.notifications",
]

# ---------------------------------------------------------------------------
# Authentication & passwords (Security Model)
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"
AUTHENTICATION_BACKENDS = ["apps.accounts.backends.EmailOrUsernameBackend"]

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.ScryptPasswordHasher",
]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
PASSWORD_RESET_TIMEOUT = 2 * 60 * 60  # reset / verification links are valid for 2 hours

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "apps.core.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.core.middleware.RequestContextMiddleware",
    "apps.core.middleware.PrivateApiCacheMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ---------------------------------------------------------------------------
# Database: MySQL 8 (local Docker or Aiven for MySQL), utf8mb4, strict mode
# ---------------------------------------------------------------------------
DATABASES = {"default": env.db("DATABASE_URL")}
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=0)
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True
if DATABASES["default"]["ENGINE"] == "django.db.backends.mysql":
    _db_options = DATABASES["default"].setdefault("OPTIONS", {})
    # Aiven MySQL service URIs include `?ssl-mode=REQUIRED`, which django-environ parses into
    # OPTIONS["ssl-mode"]. Convert that into the `ssl` dictionary expected by mysqlclient.
    _ssl_mode = str(_db_options.pop("ssl-mode", _db_options.pop("ssl_mode", ""))).upper()
    _db_options.update(
        {
            "charset": "utf8mb4",
            "init_command": (
                "SET sql_mode='STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,"
                "ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'"
            ),
        }
    )
    _db_ssl_ca = env("DB_SSL_CA", default="").strip()
    _db_ssl_ca_cert = env("DB_SSL_CA_CERT", default="").strip()
    if _db_ssl_ca_cert and not _db_ssl_ca:
        with tempfile.NamedTemporaryFile(
            mode="w", suffix="-mysql-ca.pem", delete=False
        ) as _ca_file:
            _ca_file.write(_db_ssl_ca_cert.replace("\\n", "\n"))
            _db_ssl_ca = _ca_file.name
        atexit.register(Path(_db_ssl_ca).unlink, missing_ok=True)
    if _db_ssl_ca:
        _db_options["ssl"] = {"ca": _db_ssl_ca}
        _db_options["ssl_mode"] = "VERIFY_IDENTITY"
    elif _ssl_mode in {"REQUIRED", "VERIFY_CA", "VERIFY_IDENTITY"} or env.bool(
        "DB_SSL_REQUIRED", default=False
    ):
        _db_options.setdefault("ssl", {})
        _db_options["ssl_mode"] = _ssl_mode or "REQUIRED"
    DATABASES["default"]["TEST"] = {"CHARSET": "utf8mb4", "COLLATION": "utf8mb4_unicode_ci"}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# I18N / time: stored in UTC; display time zone is a system setting (SET-01)
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# ---------------------------------------------------------------------------
# Sessions & CSRF (ADR-003: same-origin or credentialed CORS session auth)
# ---------------------------------------------------------------------------
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = env("SESSION_COOKIE_SAMESITE", default="Lax")
CSRF_COOKIE_HTTPONLY = False  # the SPA reads csrftoken and sends X-CSRFToken
CSRF_COOKIE_SAMESITE = env("CSRF_COOKIE_SAMESITE", default="Lax")

# ---------------------------------------------------------------------------
# Email delivery (SMTP or HTTPS on hosts that block SMTP)
# ---------------------------------------------------------------------------
EMAIL_HOST = env("EMAIL_HOST", default="smtp.gmail.com")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="").strip()
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="").strip()
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)
EMAIL_TIMEOUT = env.int("EMAIL_TIMEOUT", default=15)
EMAIL_FILE_PATH = env("EMAIL_FILE_PATH", default="")
GMAIL_REFRESH_TOKEN = env("GMAIL_REFRESH_TOKEN", default="").strip()
GMAIL_CLIENT_ID = env("GMAIL_CLIENT_ID", default="").strip()
GMAIL_CLIENT_SECRET = env("GMAIL_CLIENT_SECRET", default="").strip()
BREVO_API_KEY = env("BREVO_API_KEY", default="").strip()
EMAIL_BACKEND = env("EMAIL_BACKEND", default="").strip() or (
    "django.core.mail.backends.smtp.EmailBackend"
    if EMAIL_HOST_USER and EMAIL_HOST_PASSWORD
    else "django.core.mail.backends.console.EmailBackend"
)
_default_from = env("DEFAULT_FROM_EMAIL", default="").strip()
DEFAULT_FROM_EMAIL = (
    EMAIL_HOST_USER
    if EMAIL_HOST_USER and _default_from in {"", "no-reply@example.org"}
    else (_default_from or "no-reply@example.org")
)

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["apps.core.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["apps.core.permissions.IsActiveMember"],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.DefaultPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.core.exceptions.exception_handler",
    "DEFAULT_THROTTLE_CLASSES": [],
    "DEFAULT_THROTTLE_RATES": {
        "login": "5/min",
        "register": "3/hour",
        "register_attempt": "10/min",
        "password_reset": "3/hour",
        "evaluation_submit": "30/hour",
        "report_export": "60/hour",
        "audit_delete": "5/min",
    },
    # Client IP for throttling: REMOTE_ADDR, or the last X-Forwarded-For hop when behind
    # our proxy. Never trust client-supplied X-Forwarded-For (throttle bypass).
    "NUM_PROXIES": 1 if USE_X_FORWARDED_FOR else 0,
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
    # Scale values and ratings are small decimals; send them as JSON numbers.
    "COERCE_DECIMAL_TO_STRING": False,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Choir Member Evaluation System API",
    "DESCRIPTION": "REST API for the Choir Member Evaluation System (see docs/06-API).",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": r"/api/v1",
    "ENUM_NAME_OVERRIDES": {
        "HealthStateEnum": "apps.core.api.serializers.HEALTH_STATES",
        "UserStatusEnum": "apps.accounts.constants.UserStatus",
        "UserRoleEnum": "apps.accounts.constants.UserRole",
        "CycleStatusEnum": "apps.evaluations.constants.CycleStatus",
        "FormStatusEnum": "apps.evaluations.constants.FormStatus",
        "ScaleTypeEnum": "apps.evaluations.constants.ScaleType",
    },
    # Locked down by default; dev settings open it up.
    "SERVE_PERMISSIONS": ["apps.core.permissions.IsSuperAdmin"],
}

# ---------------------------------------------------------------------------
# Logging: never log comment text or evaluator/recipient pairs (Privacy Model)
# ---------------------------------------------------------------------------
LOG_LEVEL = env("LOG_LEVEL", default="INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {"format": "%(asctime)s %(levelname)s %(name)s: %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "standard"},
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django": {"handlers": ["console"], "level": LOG_LEVEL, "propagate": False},
    },
}


# ---------------------------------------------------------------------------
# Realtime (Realtime Architecture, step 5.1): Redis channel layer (or in-memory fallback)
# ---------------------------------------------------------------------------
_redis_url = env("REDIS_URL", default="redis://127.0.0.1:6380/0").strip()
BACKUP_DIR = Path(env("BACKUP_DIR", default=str(REPO_ROOT / "backups")))
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
if _redis_url and not _redis_url.startswith("memory://"):
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": _redis_url,
            "KEY_PREFIX": "choir-eval",
        }
    }
if not _redis_url or _redis_url.startswith("memory://"):
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {"hosts": [_redis_url]},
        }
    }
