"""Feedback I received (FB-01..06). The recipient is always the logged-in user: there is no
recipient parameter, so nobody can query another member's feedback."""

import uuid
from datetime import date

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.exceptions import ValidationError
from apps.core.pagination import DefaultPagination

from .. import selectors
from .serializers import FeedbackCountSerializer, FeedbackItemSerializer, FeedbackSummarySerializer

CYCLE = OpenApiParameter("cycle", str, description="Cycle public_id")


def _uuid(params, name: str):
    raw = params.get(name)
    if not raw:
        return None
    try:
        return uuid.UUID(raw)
    except ValueError as exc:
        raise ValidationError(fields={name: ["Enter a valid id."]}) from exc


def _date(params, name: str) -> date | None:
    raw = params.get(name)
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError as exc:
        raise ValidationError(fields={name: ["Use the format YYYY-MM-DD."]}) from exc


class ReceivedFeedbackView(APIView):
    @extend_schema(
        parameters=[
            CYCLE,
            OpenApiParameter("date_from", str, description="YYYY-MM-DD"),
            OpenApiParameter("date_to", str, description="YYYY-MM-DD"),
            OpenApiParameter("page", int),
        ],
        responses=FeedbackItemSerializer(many=True),
    )
    def get(self, request):
        params = request.query_params
        items = selectors.list_received(
            recipient=request.user,
            cycle_public_id=_uuid(params, "cycle"),
            date_from=_date(params, "date_from"),
            date_to=_date(params, "date_to"),
        )
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(items, request, view=self)
        return paginator.get_paginated_response(FeedbackItemSerializer(page, many=True).data)


class FeedbackSummaryView(APIView):
    @extend_schema(
        parameters=[CYCLE, OpenApiParameter("criterion", str, description="Criterion public_id")],
        responses=FeedbackSummarySerializer,
    )
    def get(self, request):
        params = request.query_params
        data = selectors.summary(
            recipient=request.user,
            cycle_public_id=_uuid(params, "cycle"),
            criterion_public_id=_uuid(params, "criterion"),
        )
        return Response(FeedbackSummarySerializer(data).data)


class FeedbackCountView(APIView):
    @extend_schema(parameters=[CYCLE], responses=FeedbackCountSerializer)
    def get(self, request):
        count = selectors.count_received(
            recipient=request.user, cycle_public_id=_uuid(request.query_params, "cycle")
        )
        return Response({"evaluations_received": count})
