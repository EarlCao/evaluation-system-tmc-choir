"""Super Admin member management (/api/v1/admin/members/..., /admin/voice-sections/...)."""

from django.db.models import Count
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.exceptions import NotFound
from apps.core.permissions import IsSuperAdmin

from .. import selectors, services
from ..models import VoiceSection
from . import admin_serializers as s


class AdminView(APIView):
    permission_classes = [IsSuperAdmin]


def _member(public_id):
    return selectors.admin_get_member(public_id=public_id)


def _member_response(public_id, code=status.HTTP_200_OK):
    return Response(s.AdminMemberSerializer(_member(public_id)).data, status=code)


class AdminMemberListView(AdminView, ListAPIView):
    serializer_class = s.AdminMemberSerializer

    @extend_schema(
        parameters=[
            OpenApiParameter("search", str),
            OpenApiParameter("status", str),
            OpenApiParameter("role", str),
            OpenApiParameter("voice_section", int),
        ]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        filters = s.AdminMemberFilterSerializer(data=self.request.query_params)
        filters.is_valid(raise_exception=True)
        values = filters.validated_data
        return selectors.admin_list_members(
            search=values["search"],
            status=values["status"],
            role=values["role"],
            voice_section=str(values.get("voice_section") or ""),
        )


class AdminMemberDetailView(AdminView):
    @extend_schema(responses=s.AdminMemberSerializer)
    def get(self, request, public_id):
        return _member_response(public_id)

    @extend_schema(request=s.AdminProfileUpdateSerializer, responses=s.AdminMemberSerializer)
    def patch(self, request, public_id):
        data = s.AdminProfileUpdateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = _member(public_id)
        profile = getattr(user, "member_profile", None)
        if profile is None:
            raise NotFound("This account has no choir profile.")
        values = dict(data.validated_data)
        if "voice_section" in values:
            values["voice_section_id"] = values.pop("voice_section")
        services.admin_update_profile(actor=request.user, profile=profile, **values)
        return _member_response(public_id)


class AdminApproveView(AdminView):
    @extend_schema(request=None, responses=s.AdminMemberSerializer)
    def post(self, request, public_id):
        services.approve(actor=request.user, user=_member(public_id))
        return _member_response(public_id)


class AdminStatusView(AdminView):
    @extend_schema(request=s.StatusChangeSerializer, responses=s.AdminMemberSerializer)
    def post(self, request, public_id):
        data = s.StatusChangeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        services.set_status(actor=request.user, user=_member(public_id), **data.validated_data)
        return _member_response(public_id)


class AdminRoleView(AdminView):
    @extend_schema(request=s.RoleChangeSerializer, responses=s.AdminMemberSerializer)
    def post(self, request, public_id):
        data = s.RoleChangeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        services.set_role(actor=request.user, user=_member(public_id), **data.validated_data)
        return _member_response(public_id)


class AdminPasswordResetView(AdminView):
    @extend_schema(request=None, responses={202: None})
    def post(self, request, public_id):
        services.send_password_reset(actor=request.user, user=_member(public_id))
        return Response(status=status.HTTP_202_ACCEPTED)


class AdminVoiceSectionListView(AdminView):
    @extend_schema(responses=s.AdminVoiceSectionSerializer(many=True))
    def get(self, request):
        sections = selectors.admin_list_voice_sections().annotate(member_count=Count("members"))
        return Response(s.AdminVoiceSectionSerializer(sections, many=True).data)

    @extend_schema(
        request=s.VoiceSectionWriteSerializer, responses={201: s.AdminVoiceSectionSerializer}
    )
    def post(self, request):
        data = s.VoiceSectionWriteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        section = services.create_voice_section(
            actor=request.user, name=data.validated_data.get("name", "")
        )
        return Response(s.AdminVoiceSectionSerializer(section).data, status=status.HTTP_201_CREATED)


class AdminVoiceSectionDetailView(AdminView):
    @extend_schema(request=s.VoiceSectionWriteSerializer, responses=s.AdminVoiceSectionSerializer)
    def patch(self, request, pk: int):
        section = VoiceSection.objects.filter(pk=pk).first()
        if section is None:
            raise NotFound()
        data = s.VoiceSectionWriteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        section = services.update_voice_section(
            actor=request.user, section=section, **data.validated_data
        )
        return Response(s.AdminVoiceSectionSerializer(section).data)
