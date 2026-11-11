from django.urls import path

from . import views

urlpatterns = [
    path('', views.account_detail),
    path('captcha/', views.captcha_challenge),
    path('signup/', views.signup),
    path('login/', views.signin),
    path('logout/', views.signout),
    path('verify-email/', views.verify_email),
    path('verify-email/resend/', views.resend_verification),
    path('password-reset/', views.password_reset),
    path('password-reset/confirm/', views.password_reset_confirm),
    path('recovery-keys/', views.recovery_key_list),
    path('change/', views.change_credentials),
    path('recover/', views.recover),
    path('export/', views.export_data),
    path('delete/', views.delete_self),
]
