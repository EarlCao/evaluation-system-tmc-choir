from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.authentication import enforce_csrf
from apps.core.exceptions import NotFound
from apps.system.constants import RegistrationMode
from apps.system.selectors import get_settings

from .. import selectors, services
from ..throttles import RegisterThrottle
from .serializers import (
    DirectoryEntrySerializer,
    MemberDetailSerializer,
    OwnProfileUpdateSerializer,
    RegisterSerializer,
    RegistrationResultSerializer,
    VoiceSectionSerializer,
)

_NEXT_STEP = {
    RegistrationMode.APPROVAL: "Your account was created and is waiting for Super Admin approval.",
    RegistrationMode.EMAIL_VERIFICATION: (
        "Your account was created. Check your email to confirm your address."
    ),
    RegistrationMode.OPEN: "Your account was created. You can now log in.",
}


class VoiceSectionListView(ListAPIView):
    """Public: needed by the registration form."""

    authentication_classes = []
    permission_classes = [AllowAny]
    pagination_class = None
    serializer_class = VoiceSectionSerializer

    def get_queryset(self):
        return selectors.list_active_voice_sections()


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [RegisterThrottle]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        enforce_csrf(request)

    @extend_schema(
        auth=[], request=RegisterSerializer, responses={201: RegistrationResultSerializer}
    )
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        user = services.register_member(voice_section_id=data.pop("voice_section"), **data)
        mode = get_settings().registration_mode
        if mode != RegistrationMode.EMAIL_VERIFICATION:
            services.send_registration_otp(user)
        detail = _NEXT_STEP.get(mode, "Your account was created.")
        return Response({"status": user.status, "detail": detail}, status=status.HTTP_201_CREATED)


class DirectoryView(ListAPIView):
    """MEM-01 / MEM-02: active members, searchable and filterable, paginated."""

    serializer_class = DirectoryEntrySerializer

    @extend_schema(
        parameters=[
            OpenApiParameter("search", str, description="Name search"),
            OpenApiParameter("voice_section", int, description="Voice section id"),
        ]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        return selectors.list_directory(params=self.request.query_params)


class MemberDetailView(APIView):
    """MEM-03: one member's profile. Inactive members answer 404."""

    @extend_schema(responses=MemberDetailSerializer)
    def get(self, request, public_id):
        profile = selectors.get_member_profile(public_id=public_id)
        return Response(MemberDetailSerializer(profile, context={"request": request}).data)


class OwnProfileView(APIView):
    """The logged-in member's own choir profile (super admins have none → 404)."""

    @extend_schema(responses=MemberDetailSerializer)
    def get(self, request):
        profile = selectors.get_own_profile(user=request.user)
        if profile is None:
            raise NotFound()
        return Response(MemberDetailSerializer(profile, context={"request": request}).data)

    @extend_schema(request=OwnProfileUpdateSerializer, responses=MemberDetailSerializer)
    def patch(self, request):
        serializer = OwnProfileUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = services.update_own_profile(user=request.user, **serializer.validated_data)
        return Response(MemberDetailSerializer(profile, context={"request": request}).data)
