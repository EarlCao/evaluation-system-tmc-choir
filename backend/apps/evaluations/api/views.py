"""Member-facing evaluation endpoints (author's perspective only)."""

import uuid

from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.exceptions import ValidationError

from .. import selectors, services
from ..throttles import EvaluationSubmitThrottle
from .serializers import (
    CurrentCycleSerializer,
    CycleFormSerializer,
    EligibilitySerializer,
    MyEvaluationSerializer,
    SubmitEvaluationSerializer,
)


class CurrentCycleView(APIView):
    """The open evaluation period, or ``{"cycle": null}``."""

    @extend_schema(responses=CurrentCycleSerializer)
    def get(self, request):
        return Response(CurrentCycleSerializer({"cycle": selectors.get_open_cycle()}).data)


class CycleFormView(APIView):
    @extend_schema(responses=CycleFormSerializer)
    def get(self, request, public_id):
        cycle = selectors.get_member_cycle(public_id=public_id)
        return Response(CycleFormSerializer(cycle).data)


class EligibilityView(APIView):
    @extend_schema(
        parameters=[OpenApiParameter("recipient", str, required=True)],
        responses=EligibilitySerializer,
    )
    def get(self, request):
        recipient = request.query_params.get("recipient", "")
        try:
            verdict = selectors.get_eligibility(viewer=request.user, recipient_public_id=recipient)
        except DjangoValidationError as exc:  # malformed UUID
            raise ValidationError(fields={"recipient": ["Enter a valid member id."]}) from exc
        return Response(EligibilitySerializer(verdict).data)


class EvaluationCreateView(APIView):
    throttle_classes = [EvaluationSubmitThrottle]

    @extend_schema(request=SubmitEvaluationSerializer, responses={201: MyEvaluationSerializer})
    def post(self, request):
        data = SubmitEvaluationSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data
        evaluation = services.submit_evaluation(
            evaluator=request.user,
            recipient_public_id=values["recipient"],
            ratings=[dict(r) for r in values["ratings"]],
            comment=values["comment"],
            suggestion=values["suggestion"],
        )
        mine = selectors.get_my_evaluation(user=request.user, public_id=evaluation.public_id)
        return Response(MyEvaluationSerializer(mine).data, status=status.HTTP_201_CREATED)


class MyEvaluationListView(ListAPIView):
    serializer_class = MyEvaluationSerializer

    @extend_schema(parameters=[OpenApiParameter("cycle", str, description="Cycle public_id")])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        cycle = self.request.query_params.get("cycle") or None
        if cycle is not None:
            try:
                cycle = uuid.UUID(cycle)
            except ValueError as exc:
                raise ValidationError(fields={"cycle": ["Enter a valid cycle id."]}) from exc
        return selectors.list_my_evaluations(user=self.request.user, cycle_public_id=cycle)


class MyEvaluationDetailView(APIView):
    @extend_schema(responses=MyEvaluationSerializer)
    def get(self, request, public_id):
        mine = selectors.get_my_evaluation(user=request.user, public_id=public_id)
        return Response(MyEvaluationSerializer(mine).data)
