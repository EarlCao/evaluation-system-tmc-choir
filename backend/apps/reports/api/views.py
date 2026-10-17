from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from .. import selectors
from .serializers import MemberDashboardSerializer


class MemberDashboardView(APIView):
    @extend_schema(responses=MemberDashboardSerializer)
    def get(self, request):
        data = selectors.member_dashboard(user=request.user)
        return Response(MemberDashboardSerializer(data).data)
