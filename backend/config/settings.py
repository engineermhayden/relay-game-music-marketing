import os
import re
from pathlib import Path
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'local-development-only-change-before-public-deployment')
DEBUG = False
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
ADMIN_URL = os.getenv('DJANGO_ADMIN_URL', 'admin/').strip('/')
if not re.fullmatch(r'[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*', ADMIN_URL) or ADMIN_URL.split('/')[0] in {'api', 'api-auth', 'ws', 'media', 'static', 'assets', 'healthz'}:
    raise ImproperlyConfigured('DJANGO_ADMIN_URL must be a nonempty URL path using letters, numbers, hyphens, underscores and slashes, outside the API/static/media routes.')
ADMIN_URL += '/'
INSTALLED_APPS = ['django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes', 'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles', 'django.contrib.gis', 'rest_framework', 'channels', 'accounts', 'game', 'music']
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware', 'django.contrib.sessions.middleware.SessionMiddleware', 'django.middleware.common.CommonMiddleware', 'django.middleware.csrf.CsrfViewMiddleware', 'django.contrib.auth.middleware.AuthenticationMiddleware', 'accounts.middleware.AccountSessionMiddleware', 'django.contrib.messages.middleware.MessageMiddleware']
TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates', 'APP_DIRS': True, 'OPTIONS': {'context_processors': ['django.template.context_processors.request', 'django.contrib.auth.context_processors.auth', 'django.contrib.messages.context_processors.messages']}}]
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = Path(os.getenv('MEDIA_ROOT', str(BASE_DIR / 'media')))
SAMPLE_SONGS_DIR = Path(os.getenv('SAMPLE_SONGS_DIR', str(BASE_DIR.parent / 'marketing' / 'sample-songs')))
FILE_UPLOAD_PERMISSIONS = 0o644
ROOT_URLCONF = 'config.urls'
ASGI_APPLICATION = 'config.asgi.application'
DATABASES = {'default': {'ENGINE': 'django.contrib.gis.db.backends.postgis', 'NAME': os.getenv('POSTGRES_DB', 'relay'), 'USER': os.getenv('POSTGRES_USER', 'relay'), 'PASSWORD': os.getenv('POSTGRES_PASSWORD', 'relay-local-change-me'), 'HOST': os.getenv('DB_HOST', 'localhost'), 'PORT': os.getenv('DB_PORT', '5432'), 'CONN_MAX_AGE': 60}}
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
CHANNEL_LAYERS = {'default': {'BACKEND': 'channels_redis.core.RedisChannelLayer', 'CONFIG': {'hosts': [REDIS_URL], 'capacity': 200, 'expiry': 10}}}
CACHES = {'default': {'BACKEND': 'django.core.cache.backends.redis.RedisCache', 'LOCATION': REDIS_URL}}
REST_FRAMEWORK = {'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'], 'DEFAULT_AUTHENTICATION_CLASSES': [], 'DEFAULT_THROTTLE_CLASSES': ['rest_framework.throttling.AnonRateThrottle'], 'DEFAULT_THROTTLE_RATES': {'anon': '180/min'}, 'UNAUTHENTICATED_USER': None}
CSRF_TRUSTED_ORIGINS = os.getenv('CSRF_TRUSTED_ORIGINS', 'http://localhost:8080,http://127.0.0.1:8080').split(',')
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = os.getenv('COOKIE_SECURE', 'false').lower() == 'true'
CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
SESSION_COOKIE_AGE = 60 * 60 * 24 * 30
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
USE_TZ = True
TIME_ZONE = 'UTC'
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY') or os.getenv('ANTROPIC_API_KEY', '')
ANTHROPIC_MODEL = os.getenv('ANTHROPIC_MODEL', 'claude-sonnet-4-6')
AI_DAILY_REQUEST_LIMIT = int(os.getenv('AI_DAILY_REQUEST_LIMIT', '100'))

# Optional player accounts (email + password). Guests can always play without one.
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]
PASSWORD_RESET_TIMEOUT = 60 * 60
ACCOUNT_EMAIL_VERIFICATION_MAX_AGE = 60 * 60 * 72
ACCOUNT_SIGNUPS_PER_IP_HOUR = 20
ACCOUNT_LOGIN_FAILURES_PER_IP = 50
ACCOUNT_LOGIN_FAILURES_PER_EMAIL = 10
ACCOUNT_RESETS_PER_IP_HOUR = 20
ACCOUNT_EMAILS_PER_ADDRESS_HOUR = 3
# Self-hosted CAPTCHA on sign-up, sign-in and password-reset requests (accounts/captcha.py).
ACCOUNT_CAPTCHA_TTL = 10 * 60
ACCOUNT_CAPTCHAS_PER_IP = 60  # New images per 10 minutes.
# End-to-end tests only: also accept the answer PASSED. Never enable on a public site.
ACCOUNT_CAPTCHA_TEST_MODE = os.getenv('CAPTCHA_TEST_MODE', 'false').lower() == 'true'
if ACCOUNT_CAPTCHA_TEST_MODE and SESSION_COOKIE_SECURE:
    raise ImproperlyConfigured('CAPTCHA_TEST_MODE is for local end-to-end tests and cannot be combined with COOKIE_SECURE=true.')
# Public origin used in verification and reset links, e.g. https://relay.example.com.
# When blank, links use the request's host (already restricted by ALLOWED_HOSTS).
PUBLIC_SITE_URL = os.getenv('PUBLIC_SITE_URL', '').strip().rstrip('/')
if PUBLIC_SITE_URL and not re.fullmatch(r'https?://[^/\s?#]+', PUBLIC_SITE_URL):
    raise ImproperlyConfigured('PUBLIC_SITE_URL must be an origin such as https://relay.example.com, without a path.')
# Without EMAIL_HOST, emails are printed to the API container log (docker compose logs api).
EMAIL_HOST = os.getenv('EMAIL_HOST', '')
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND') or ('django.core.mail.backends.smtp.EmailBackend' if EMAIL_HOST else 'django.core.mail.backends.console.EmailBackend')
EMAIL_PORT = int(os.getenv('EMAIL_PORT') or '587')
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = (os.getenv('EMAIL_USE_TLS') or 'true').lower() == 'true'
EMAIL_USE_SSL = (os.getenv('EMAIL_USE_SSL') or 'false').lower() == 'true'
if EMAIL_USE_TLS and EMAIL_USE_SSL:
    raise ImproperlyConfigured('Set only one of EMAIL_USE_TLS (STARTTLS, usually port 587) or EMAIL_USE_SSL (usually port 465).')
EMAIL_TIMEOUT = 15
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL') or 'RELAY <no-reply@localhost>'
SERVER_EMAIL = DEFAULT_FROM_EMAIL
