from django.urls import path

from . import views

urlpatterns = [
    path('', views.feedback_list),
    path('<int:pk>/vote/', views.vote),
]
