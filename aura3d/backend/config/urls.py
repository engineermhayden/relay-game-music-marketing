from django.urls import path
from game import views

urlpatterns = [
    path('api/health/', views.health),
    path('api/session/', views.session_view),
    path('api/rooms/', views.rooms),
    path('api/rooms/join/', views.join),
    path('api/rooms/<str:code>/', views.room_detail),
    path('api/rooms/<str:code>/nearby/', views.nearby),
    path('api/rooms/<str:code>/ai/', views.ai_director),
    path('api/leaderboard/', views.leaderboard),
]
