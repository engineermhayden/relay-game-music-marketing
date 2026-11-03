import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
from django.core.asgi import get_asgi_application
django_app = get_asgi_application()
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.sessions import SessionMiddlewareStack
from channels.security.websocket import AllowedHostsOriginValidator
from django.urls import re_path
from game.consumers import ExpeditionConsumer

application = ProtocolTypeRouter({'http': django_app, 'websocket': AllowedHostsOriginValidator(SessionMiddlewareStack(URLRouter([re_path(r'^ws/rooms/(?P<code>[A-Z0-9]{6})/$', ExpeditionConsumer.as_asgi())])))})
