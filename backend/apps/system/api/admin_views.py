"""Super Admin system settings (/api/v1/admin/settings/, SET-01, SET-03)."""

from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsSuperAdmin

from .. import services
from ..models import SystemSettings
from .admin_serializers import AdminSettingsSerializer, SettingsUpdateSerializer


class AdminSettingsView(APIView):
    permission_classes = [IsSuperAdmin]

    @extend_schema(responses=AdminSettingsSerializer)
    def get(self, request):
        # Fresh from the database (not the cache) so the form always shows the saved values.
        return Response(AdminSettingsSerializer(SystemSettings.load()).data)

    @extend_schema(request=SettingsUpdateSerializer, responses=AdminSettingsSerializer)
    def patch(self, request):
        data = SettingsUpdateSerializer(data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        services.update_settings(actor=request.user, **data.validated_data)
        return Response(AdminSettingsSerializer(SystemSettings.load()).data)
