import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'local-development-only-change-before-public-deployment')
DEBUG = False
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
INSTALLED_APPS = ['django.contrib.auth', 'django.contrib.contenttypes', 'django.contrib.sessions', 'django.contrib.gis', 'rest_framework', 'channels', 'game']
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware', 'django.contrib.sessions.middleware.SessionMiddleware', 'django.middleware.common.CommonMiddleware', 'django.middleware.csrf.CsrfViewMiddleware', 'django.contrib.auth.middleware.AuthenticationMiddleware']
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
