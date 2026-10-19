from django.http import FileResponse
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsSuperAdmin
from apps.evaluations import services as evaluation_services

from .. import backup, services
from ..models import SystemSettings
from .admin_serializers import (
    AdminSettingsSerializer,
    BackupCreateSerializer,
    BackupMetadataSerializer,
    RestoreRequestSerializer,
    RetentionCleanupResponseSerializer,
    SettingsUpdateSerializer,
)


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


class AdminBackupListView(APIView):
    permission_classes = [IsSuperAdmin]

    @extend_schema(responses=BackupMetadataSerializer(many=True))
    def get(self, request):
        items = backup.list_backups()
        return Response(BackupMetadataSerializer(items, many=True).data)

    @extend_schema(request=BackupCreateSerializer, responses=BackupMetadataSerializer)
    def post(self, request):
        serializer = BackupCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        meta = backup.create_backup(actor=request.user, note=serializer.validated_data.get("note", ""))
        return Response(BackupMetadataSerializer(meta).data, status=status.HTTP_201_CREATED)


class AdminBackupDownloadView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request, filename):
        path = backup.get_backup_file_path(filename)
        return FileResponse(
            open(path, "rb"),
            as_attachment=True,
            filename=path.name,
            content_type="application/gzip",
        )


class AdminBackupDeleteView(APIView):
    permission_classes = [IsSuperAdmin]

    def delete(self, request, filename):
        backup.delete_backup(filename, actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminRestoreView(APIView):
    permission_classes = [IsSuperAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(request=RestoreRequestSerializer)
    def post(self, request):
        file_obj = request.FILES.get("file")
        filename = request.data.get("filename")
        content = file_obj.read() if file_obj else None
        result = backup.restore_backup(
            filename=filename or None, file_content=content, actor=request.user
        )
        return Response(result)


class AdminRetentionCleanupView(APIView):
    permission_classes = [IsSuperAdmin]

    @extend_schema(responses=RetentionCleanupResponseSerializer)
    def post(self, request):
        result = evaluation_services.apply_retention(actor=request.user)
        return Response(RetentionCleanupResponseSerializer(result).data)

