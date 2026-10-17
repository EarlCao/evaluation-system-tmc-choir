"""Super Admin reports (/api/v1/admin/reports/...)."""

from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsSuperAdmin

from .. import selectors
from .serializers import AdminDashboardSerializer


class AdminDashboardView(APIView):
    permission_classes = [IsSuperAdmin]

    @extend_schema(responses=AdminDashboardSerializer)
    def get(self, request):
        return Response(AdminDashboardSerializer(selectors.admin_dashboard()).data)
