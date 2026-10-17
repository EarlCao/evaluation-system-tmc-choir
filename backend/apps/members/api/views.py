from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.authentication import enforce_csrf
from apps.system.constants import RegistrationMode
from apps.system.selectors import get_settings

from .. import selectors, services
from ..throttles import RegisterThrottle
from .serializers import RegisterSerializer, RegistrationResultSerializer, VoiceSectionSerializer

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
        detail = _NEXT_STEP.get(get_settings().registration_mode, "Your account was created.")
        return Response({"status": user.status, "detail": detail}, status=status.HTTP_201_CREATED)
