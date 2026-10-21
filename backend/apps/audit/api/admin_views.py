"""Super Admin audit viewer and confirmed deletion exception (AUD-03/04, ADR-022)."""

from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.core.permissions import IsSuperAdmin

from .. import selectors, services
from . import admin_serializers as s

FILTER_PARAMS = [
    OpenApiParameter("search", str, description="Event type, target id, IP or request id"),
    OpenApiParameter("event_type", str, description="Exact, or a prefix ending in '.'"),
    OpenApiParameter("actor", str, description="User public id"),
    OpenApiParameter("target_type", str),
    OpenApiParameter("target_id", str),
    OpenApiParameter("occurred_from", str, description="YYYY-MM-DD (UTC)"),
    OpenApiParameter("occurred_to", str, description="YYYY-MM-DD (UTC)"),
]


def _filters(params) -> dict:
    data = s.AuditFilterSerializer(data=params)
    data.is_valid(raise_exception=True)
    return dict(data.validated_data)


class AuditDeletionThrottle(UserRateThrottle):
    scope = "audit_delete"


class AuditDeletionMixin:
    def get_throttles(self):
        if self.request.method == "DELETE":
            return [AuditDeletionThrottle()]
        return super().get_throttles()


class AuditLogListView(AuditDeletionMixin, ListAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class = s.AuditLogSerializer

    @extend_schema(parameters=FILTER_PARAMS)
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        return selectors.list_logs(**_filters(self.request.query_params))

    @extend_schema(
        operation_id="admin_audit_logs_clear",
        request=s.AuditDeleteSerializer,
        responses=s.AuditDeleteResultSerializer,
    )
    def delete(self, request):
        data = s.AuditDeleteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        deleted = services.delete_logs(actor=request.user, **data.validated_data)
        return Response({"deleted": deleted})


class AuditLogDetailView(AuditDeletionMixin, APIView):
    permission_classes = [IsSuperAdmin]

    @extend_schema(responses=s.AuditLogSerializer)
    def get(self, request, pk: int):
        return Response(s.AuditLogSerializer(selectors.get_log(pk=pk)).data)

    @extend_schema(
        operation_id="admin_audit_log_delete",
        request=s.AuditDeleteSerializer,
        responses=s.AuditDeleteResultSerializer,
    )
    def delete(self, request, pk: int):
        data = s.AuditDeleteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        deleted = services.delete_logs(actor=request.user, pk=pk, **data.validated_data)
        return Response({"deleted": deleted})


class AuditEventTypesView(APIView):
    permission_classes = [IsSuperAdmin]

    @extend_schema(responses={200: {"type": "array", "items": {"type": "string"}}})
    def get(self, request):
        return Response(selectors.list_event_types())


class AuditExportView(APIView):
    permission_classes = [IsSuperAdmin]

    @extend_schema(
        parameters=[
            OpenApiParameter("file_type", str, required=True, enum=["csv", "xlsx"]),
            *FILTER_PARAMS,
        ],
        responses={(200, "application/octet-stream"): OpenApiTypes.BINARY},
    )
    def get(self, request):
        meta = s.AuditExportSerializer(data=request.query_params)
        meta.is_valid(raise_exception=True)
        params = request.query_params.copy()
        params.pop("file_type", None)
        stem, content_type, content = services.export_logs(
            actor=request.user, file_type=meta.validated_data["file_type"], filters=_filters(params)
        )
        response = HttpResponse(content, content_type=content_type)
        filename = f"{stem}-{timezone.now():%Y-%m-%d}.{meta.validated_data['file_type']}"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
