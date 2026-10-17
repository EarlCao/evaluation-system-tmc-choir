"""Super Admin reports (/api/v1/admin/reports/...)."""

from django.http import HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsSuperAdmin

from .. import selectors, services
from ..throttles import ReportExportThrottle
from . import admin_serializers as s
from .serializers import AdminDashboardSerializer


class AdminDashboardView(APIView):
    permission_classes = [IsSuperAdmin]

    @extend_schema(responses=AdminDashboardSerializer)
    def get(self, request):
        return Response(AdminDashboardSerializer(selectors.admin_dashboard()).data)


def _filters(serializer_class, params) -> dict:
    data = serializer_class(data=params)
    data.is_valid(raise_exception=True)
    return dict(data.validated_data)


_DATE_PARAMS = [
    OpenApiParameter("cycle", str),
    OpenApiParameter("submitted_from", str, description="YYYY-MM-DD"),
    OpenApiParameter("submitted_to", str, description="YYYY-MM-DD"),
]


class ChoirSummaryView(APIView):
    permission_classes = [IsSuperAdmin]

    @extend_schema(
        parameters=[
            *_DATE_PARAMS,
            OpenApiParameter("voice_section", int),
            OpenApiParameter("criterion", str),
        ],
        responses=s.ChoirSummarySerializer,
    )
    def get(self, request):
        filters = _filters(s.ChoirFilterSerializer, request.query_params)
        return Response(s.ChoirSummarySerializer(selectors.choir_summary(**filters)).data)


class MemberSummaryView(APIView):
    permission_classes = [IsSuperAdmin]

    @extend_schema(parameters=_DATE_PARAMS, responses=s.MemberSummarySerializer)
    def get(self, request, public_id):
        filters = _filters(s.MemberFilterSerializer, request.query_params)
        data = selectors.member_summary(public_id=public_id, **filters)
        return Response(s.MemberSummarySerializer(data).data)


class ParticipationReportView(APIView):
    permission_classes = [IsSuperAdmin]

    @extend_schema(
        parameters=[OpenApiParameter("cycle", str, required=True)],
        responses=s.ParticipationReportSerializer,
    )
    def get(self, request):
        cycle = _filters(s.ParticipationFilterSerializer, request.query_params)["cycle"]
        data = selectors.participation_report(cycle_public_id=cycle)
        return Response(s.ParticipationReportSerializer(data).data)


EXPORT_FILTERS = {
    "choir": s.ChoirFilterSerializer,
    "member": s.MemberFilterSerializer,
    "participation": s.ParticipationFilterSerializer,
    "evaluations": s.EvaluationExportFilterSerializer,
}


class ExportView(APIView):
    """ADM-07: CSV / Excel / PDF. Each export is audited; filenames carry no names."""

    permission_classes = [IsSuperAdmin]
    throttle_classes = [ReportExportThrottle]

    @extend_schema(
        parameters=[
            OpenApiParameter("report", str, required=True, enum=list(services.REPORTS)),
            OpenApiParameter("file_type", str, required=True, enum=list(services.FILE_TYPES)),
            OpenApiParameter("member", str, description="Required for report=member"),
            *_DATE_PARAMS,
        ],
        responses={(200, "application/octet-stream"): OpenApiTypes.BINARY},
    )
    def get(self, request):
        meta = _filters(s.ExportRequestSerializer, request.query_params)
        params = request.query_params.copy()
        for key in ("report", "file_type", "member"):
            params.pop(key, None)
        filters = _filters(EXPORT_FILTERS[meta["report"]], params)
        if meta["report"] == "member":
            filters["member"] = str(meta["member"]) if meta.get("member") else ""
        if meta["report"] == "participation":
            filters["cycle"] = str(filters["cycle"])
        export = services.generate_export(
            actor=request.user,
            report=meta["report"],
            file_type=meta["file_type"],
            filters=filters,
        )
        response = HttpResponse(export.content, content_type=export.content_type)
        response["Content-Disposition"] = f'attachment; filename="{export.filename}"'
        return response
