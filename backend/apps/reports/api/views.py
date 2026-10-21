from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from .. import selectors, services
from .serializers import MemberDashboardSerializer, MyDataExportSerializer


class MemberDashboardView(APIView):
    @extend_schema(responses=MemberDashboardSerializer)
    def get(self, request):
        data = selectors.member_dashboard(user=request.user)
        return Response(MemberDashboardSerializer(data).data)


class MyDataExportView(APIView):
    @extend_schema(responses=MyDataExportSerializer)
    def get(self, request):
        data = services.export_own_data(user=request.user)
        return Response(data)
