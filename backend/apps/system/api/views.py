from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .. import selectors
from .serializers import PublicSettingsSerializer


class PublicSettingsView(APIView):
    """SET-03: system name, choir info, privacy notice, registration mode (anyone)."""

    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(auth=[], responses=PublicSettingsSerializer)
    def get(self, request):
        return Response(PublicSettingsSerializer(selectors.get_public_settings()).data)
