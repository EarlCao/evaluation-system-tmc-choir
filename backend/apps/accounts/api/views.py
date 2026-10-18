from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.authentication import enforce_csrf

from .. import services
from ..constants import PASSWORD_RESET_SENT_MESSAGE
from ..throttles import LoginThrottle, PasswordResetThrottle
from .serializers import (
    DeactivateAccountSerializer,
    DetailSerializer,
    EmailVerificationSerializer,
    LoginSerializer,
    MeSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
)


class PublicCsrfProtectedView(APIView):
    """Anonymous endpoints that change state. DRF only checks CSRF for authenticated
    session requests, so these enforce it explicitly (prevents login CSRF)."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        enforce_csrf(request)


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """Sets the ``csrftoken`` cookie. The SPA calls this once on start-up."""

    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(auth=[], responses=DetailSerializer)
    def get(self, request):
        get_token(request)
        return Response({"detail": "CSRF cookie set."})


class LoginView(PublicCsrfProtectedView):
    throttle_classes = [LoginThrottle]

    @extend_schema(auth=[], request=LoginSerializer, responses=MeSerializer)
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.authenticate_and_login(
            request=request._request, **serializer.validated_data
        )
        return Response(MeSerializer(user).data)


class LogoutView(APIView):
    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        services.logout(request=request._request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    @extend_schema(responses=MeSerializer)
    def get(self, request):
        return Response(MeSerializer(request.user).data)

    @extend_schema(request=MeSerializer, responses=MeSerializer)
    def patch(self, request):
        serializer = MeSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = services.update_own_profile(user=request.user, **serializer.validated_data)
        return Response(MeSerializer(user).data)


class PasswordChangeView(APIView):
    @extend_schema(request=PasswordChangeSerializer, responses=DetailSerializer)
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.change_password(
            request=request._request, user=request.user, **serializer.validated_data
        )
        return Response({"detail": "Password changed."})


class PasswordResetRequestView(PublicCsrfProtectedView):
    throttle_classes = [PasswordResetThrottle]

    @extend_schema(
        auth=[], request=PasswordResetRequestSerializer, responses={202: DetailSerializer}
    )
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.request_password_reset(**serializer.validated_data)
        return Response({"detail": PASSWORD_RESET_SENT_MESSAGE}, status=status.HTTP_202_ACCEPTED)


class PasswordResetConfirmView(PublicCsrfProtectedView):
    throttle_classes = [PasswordResetThrottle]

    @extend_schema(auth=[], request=PasswordResetConfirmSerializer, responses=DetailSerializer)
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        services.confirm_password_reset(
            uidb64=data.get("uid", ""),
            token=data.get("token", ""),
            new_password=data["new_password"],
            email=data.get("email", ""),
            otp=data.get("otp", ""),
        )
        return Response({"detail": "Your password has been reset. You can now log in."})


class EmailVerificationView(PublicCsrfProtectedView):
    throttle_classes = [PasswordResetThrottle]

    @extend_schema(auth=[], request=EmailVerificationSerializer, responses=DetailSerializer)
    def post(self, request):
        serializer = EmailVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        services.verify_email(
            uidb64=data.get("uid", ""),
            token=data.get("token", ""),
            email=data.get("email", ""),
            otp=data.get("otp", ""),
        )
        return Response({"detail": "Your email address is confirmed. You can now log in."})


class DeactivateAccountView(APIView):
    @extend_schema(request=DeactivateAccountSerializer, responses=DetailSerializer)
    def post(self, request):
        serializer = DeactivateAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.deactivate_own_account(
            request=request._request, user=request.user, **serializer.validated_data
        )
        return Response({"detail": "Your account has been deactivated."})

