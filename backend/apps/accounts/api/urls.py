from django.urls import path

from . import views

app_name = "accounts"

urlpatterns = [
    path("csrf/", views.CsrfView.as_view(), name="csrf"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("me/", views.MeView.as_view(), name="me"),
    path("password-change/", views.PasswordChangeView.as_view(), name="password-change"),
    path("password-reset/", views.PasswordResetRequestView.as_view(), name="password-reset"),
    path(
        "password-reset/confirm/",
        views.PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
    path("verify-email/", views.EmailVerificationView.as_view(), name="verify-email"),
    path("deactivate/", views.DeactivateAccountView.as_view(), name="deactivate"),
]
