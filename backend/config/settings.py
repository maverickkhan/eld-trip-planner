"""
Django settings for the ELD trip planner backend.

All deployment-sensitive values are read from environment variables so the
same code runs locally (SQLite, DEBUG on) and on Render/Railway/Fly
(Postgres, DEBUG off).
"""

import os
from pathlib import Path

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# --- Core -------------------------------------------------------------------

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-insecure-secret-key")
DEBUG = env_bool("DJANGO_DEBUG", default=True)

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
# Render injects RENDER_EXTERNAL_HOSTNAME for web services; its health checker
# may use the internal onrender.com hostname, so allow that domain too.
_render_host = os.environ.get("RENDER_EXTERNAL_HOSTNAME")
if _render_host:
    ALLOWED_HOSTS.extend([_render_host, ".onrender.com"])

CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "trips",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

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

WSGI_APPLICATION = "config.wsgi.application"

# --- Database ---------------------------------------------------------------

DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
        conn_health_checks=True,
    )
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Cache (used to memoise geocoding / routing lookups) --------------------

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "eld-trip-planner",
    }
}

# --- Auth / i18n ------------------------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
# ELD log sheets are drawn against the driver's home-terminal wall clock, so
# every datetime in this project is a naive local time.  Timezone support is
# deliberately off to avoid silent UTC conversions.
USE_TZ = False

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# --- CORS -------------------------------------------------------------------

CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
# Allow every *.vercel.app preview deployment in addition to the explicit list.
CORS_ALLOWED_ORIGIN_REGEXES = env_list(
    "CORS_ALLOWED_ORIGIN_REGEXES",
    r"^https://.*\.vercel\.app$",
)

# --- DRF --------------------------------------------------------------------

REST_FRAMEWORK = {
    # The browsable HTML API needs served static files, which this API-only
    # deployment does not ship; keep it for local development only.
    "DEFAULT_RENDERER_CLASSES": (
        ["rest_framework.renderers.JSONRenderer", "rest_framework.renderers.BrowsableAPIRenderer"]
        if DEBUG
        else ["rest_framework.renderers.JSONRenderer"]
    ),
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "UNAUTHENTICATED_USER": None,
    "EXCEPTION_HANDLER": "trips.exceptions.api_exception_handler",
}

# --- External services ------------------------------------------------------

# Nominatim (OpenStreetMap) geocoder. Free, key-less. Usage policy requires a
# descriptive User-Agent and at most 1 request/second.
GEOCODER_BASE_URL = os.environ.get("GEOCODER_BASE_URL", "https://nominatim.openstreetmap.org")
GEOCODER_USER_AGENT = os.environ.get(
    "GEOCODER_USER_AGENT", "eld-trip-planner/0.1 (take-home assessment)"
)
GEOCODER_MIN_INTERVAL_SECONDS = float(os.environ.get("GEOCODER_MIN_INTERVAL_SECONDS", "1.0"))
# Bias search results; "us" is the right default for FMCSA-regulated trips.
GEOCODER_COUNTRY_CODES = os.environ.get("GEOCODER_COUNTRY_CODES", "us")

# OSRM routing engine. The public demo server is free and key-less; point this
# at a self-hosted OSRM instance for production traffic.
OSRM_BASE_URL = os.environ.get("OSRM_BASE_URL", "https://router.project-osrm.org")
OSRM_PROFILE = os.environ.get("OSRM_PROFILE", "driving")

EXTERNAL_REQUEST_TIMEOUT_SECONDS = float(os.environ.get("EXTERNAL_REQUEST_TIMEOUT_SECONDS", "20"))

# OSRM's "driving" profile models a car. Trucks are typically speed-limited,
# so legs whose implied average speed exceeds this are slowed down.
TRUCK_MAX_AVERAGE_SPEED_MPH = float(os.environ.get("TRUCK_MAX_AVERAGE_SPEED_MPH", "60"))

# --- Logging ----------------------------------------------------------------

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": os.environ.get("DJANGO_LOG_LEVEL", "INFO")},
}

# --- Security (production) --------------------------------------------------

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    # Hosts like Render terminate TLS at their edge and probe the service over
    # plain HTTP; leave the redirect off there (DJANGO_SECURE_SSL_REDIRECT=false)
    # and never redirect the health check itself.
    SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", default=True)
    SECURE_REDIRECT_EXEMPT = [r"^api/health/$"]
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
