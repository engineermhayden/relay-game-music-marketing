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
INSTALLED_APPS = ['django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes', 'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles', 'django.contrib.gis', 'rest_framework', 'channels', 'game', 'music']
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware', 'django.contrib.sessions.middleware.SessionMiddleware', 'django.middleware.common.CommonMiddleware', 'django.middleware.csrf.CsrfViewMiddleware', 'django.contrib.auth.middleware.AuthenticationMiddleware', 'django.contrib.messages.middleware.MessageMiddleware']
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
