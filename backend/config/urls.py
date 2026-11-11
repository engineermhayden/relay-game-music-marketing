from django.contrib import admin
from django.conf import settings
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from game import views
from music.api import TrackViewSet

music_router = DefaultRouter()
music_router.register('tracks', TrackViewSet, basename='track')

urlpatterns = [
    path(settings.ADMIN_URL, admin.site.urls),
    path('api-auth/', include('rest_framework.urls')),
    path('api/music/', include(music_router.urls)),
    path('api/account/', include('accounts.urls')),
    path('api/health/', views.health),
    path('api/session/', views.session_view),
    path('api/rooms/', views.rooms),
    path('api/rooms/join/', views.join),
    path('api/rooms/<str:code>/', views.room_detail),
    path('api/rooms/<str:code>/nearby/', views.nearby),
    path('api/rooms/<str:code>/ai/', views.ai_director),
    path('api/leaderboard/', views.leaderboard),
]
