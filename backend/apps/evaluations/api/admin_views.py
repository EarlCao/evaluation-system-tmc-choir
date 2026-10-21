"""Super Admin configuration endpoints (/api/v1/admin/...). Thin: validate → service → serialize."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.exceptions import ValidationError
from apps.core.permissions import IsSuperAdmin

from .. import selectors, services
from ..models import FormVersion
from . import admin_serializers as s


class AdminView(APIView):
    permission_classes = [IsSuperAdmin]


def _form_pk(public_id) -> int | None:
    """Translate a form public_id from the API into its PK (None stays None)."""
    if public_id is None:
        return None
    pk = FormVersion.objects.filter(public_id=public_id).values_list("pk", flat=True).first()
    if pk is None:
        raise ValidationError(fields={"form_version": ["Choose a published form version."]})
    return pk


# Categories ------------------------------------------------------------------
class CategoryListView(AdminView):
    @extend_schema(responses=s.CategorySerializer(many=True))
    def get(self, request):
        include = request.query_params.get("include_archived") == "true"
        return Response(
            s.CategorySerializer(
                selectors.list_categories(include_archived=include), many=True
            ).data
        )

    @extend_schema(request=s.CategoryCreateSerializer, responses={201: s.CategorySerializer})
    def post(self, request):
        data = s.CategoryCreateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        category = services.create_category(actor=request.user, **data.validated_data)
        return Response(s.CategorySerializer(category).data, status=status.HTTP_201_CREATED)


class CategoryDetailView(AdminView):
    @extend_schema(request=s.CategoryUpdateSerializer, responses=s.CategorySerializer)
    def patch(self, request, pk: int):
        data = s.CategoryUpdateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        category = services.update_category(
            actor=request.user, category=selectors.get_category(pk=pk), **data.validated_data
        )
        return Response(s.CategorySerializer(category).data)

    @extend_schema(request=None, responses={204: None})
    def delete(self, request, pk: int):
        services.delete_category(actor=request.user, category=selectors.get_category(pk=pk))
        return Response(status=status.HTTP_204_NO_CONTENT)


# Criteria --------------------------------------------------------------------
class CriterionListView(AdminView):
    @extend_schema(responses=s.CriterionSerializer(many=True))
    def get(self, request):
        include = request.query_params.get("include_archived") == "true"
        criteria = selectors.list_criteria(include_archived=include)
        return Response(s.CriterionSerializer(criteria, many=True).data)

    @extend_schema(request=s.CriterionCreateSerializer, responses={201: s.CriterionSerializer})
    def post(self, request):
        data = s.CriterionCreateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = dict(data.validated_data)
        criterion = services.create_criterion(
            actor=request.user, category_id=values.pop("category"), **values
        )
        return Response(
            s.CriterionSerializer(selectors.get_criterion(public_id=criterion.public_id)).data,
            status=status.HTTP_201_CREATED,
        )


class CriterionDetailView(AdminView):
    @extend_schema(responses=s.CriterionSerializer)
    def get(self, request, public_id):
        return Response(s.CriterionSerializer(selectors.get_criterion(public_id=public_id)).data)

    @extend_schema(request=s.CriterionUpdateSerializer, responses=s.CriterionSerializer)
    def patch(self, request, public_id):
        data = s.CriterionUpdateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = dict(data.validated_data)
        if "category" in values:
            values["category_id"] = values.pop("category")
        criterion = services.update_criterion(
            actor=request.user, criterion=selectors.get_criterion(public_id=public_id), **values
        )
        return Response(
            s.CriterionSerializer(selectors.get_criterion(public_id=criterion.public_id)).data
        )

    @extend_schema(request=None, responses={204: None})
    def delete(self, request, public_id):
        services.delete_criterion(
            actor=request.user, criterion=selectors.get_criterion(public_id=public_id)
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class CriterionArchiveView(AdminView):
    @extend_schema(request=None, responses=s.CriterionSerializer)
    def post(self, request, public_id):
        criterion = services.archive_criterion(
            actor=request.user, criterion=selectors.get_criterion(public_id=public_id)
        )
        return Response(s.CriterionSerializer(criterion).data)


class CriterionVersionsView(AdminView):
    @extend_schema(responses=s.CriterionVersionSerializer(many=True))
    def get(self, request, public_id):
        criterion = selectors.get_criterion(public_id=public_id)
        versions = selectors.list_criterion_versions(criterion=criterion)
        return Response(s.CriterionVersionSerializer(versions, many=True).data)


class CriterionReorderView(AdminView):
    @extend_schema(request=s.ReorderSerializer, responses=s.CriterionSerializer(many=True))
    def post(self, request):
        data = s.ReorderSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        services.reorder_criteria(
            actor=request.user, ordered_public_ids=[str(u) for u in data.validated_data["order"]]
        )
        return Response(s.CriterionSerializer(selectors.list_criteria(), many=True).data)


# Comment prompts ---------------------------------------------------------------
class CommentPromptListView(AdminView):
    @extend_schema(responses=s.CommentPromptSerializer(many=True))
    def get(self, request):
        include = request.query_params.get("include_archived") == "true"
        prompts = selectors.list_comment_prompts(include_archived=include)
        return Response(s.CommentPromptSerializer(prompts, many=True).data)

    @extend_schema(
        request=s.CommentPromptCreateSerializer, responses={201: s.CommentPromptSerializer}
    )
    def post(self, request):
        data = s.CommentPromptCreateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        prompt = services.create_comment_prompt(actor=request.user, **data.validated_data)
        return Response(
            s.CommentPromptSerializer(
                selectors.get_comment_prompt(public_id=prompt.public_id)
            ).data,
            status=status.HTTP_201_CREATED,
        )


class CommentPromptDetailView(AdminView):
    @extend_schema(responses=s.CommentPromptSerializer)
    def get(self, request, public_id):
        return Response(
            s.CommentPromptSerializer(selectors.get_comment_prompt(public_id=public_id)).data
        )

    @extend_schema(request=s.CommentPromptUpdateSerializer, responses=s.CommentPromptSerializer)
    def patch(self, request, public_id):
        data = s.CommentPromptUpdateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        prompt = services.update_comment_prompt(
            actor=request.user,
            prompt=selectors.get_comment_prompt(public_id=public_id),
            **data.validated_data,
        )
        return Response(
            s.CommentPromptSerializer(selectors.get_comment_prompt(public_id=prompt.public_id)).data
        )

    @extend_schema(request=None, responses={204: None})
    def delete(self, request, public_id):
        services.delete_comment_prompt(
            actor=request.user, prompt=selectors.get_comment_prompt(public_id=public_id)
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class CommentPromptArchiveView(AdminView):
    @extend_schema(request=None, responses=s.CommentPromptSerializer)
    def post(self, request, public_id):
        prompt = services.archive_comment_prompt(
            actor=request.user, prompt=selectors.get_comment_prompt(public_id=public_id)
        )
        return Response(s.CommentPromptSerializer(prompt).data)


class CommentPromptReorderView(AdminView):
    @extend_schema(request=s.ReorderSerializer, responses=s.CommentPromptSerializer(many=True))
    def post(self, request):
        data = s.ReorderSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        services.reorder_comment_prompts(
            actor=request.user, ordered_public_ids=[str(u) for u in data.validated_data["order"]]
        )
        return Response(s.CommentPromptSerializer(selectors.list_comment_prompts(), many=True).data)


# Form versions -----------------------------------------------------------------
class FormListView(AdminView, ListAPIView):
    serializer_class = s.FormVersionSerializer

    def get_queryset(self):
        return selectors.list_form_versions()

    @extend_schema(request=s.FormWriteSerializer, responses={201: s.FormVersionSerializer})
    def post(self, request):
        data = s.FormWriteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = dict(data.validated_data)
        criteria = [str(u) for u in values.pop("criteria")]
        form = services.create_form_version(actor=request.user, criteria=criteria, **values)
        return Response(
            s.FormVersionSerializer(selectors.get_form_version(public_id=form.public_id)).data,
            status=status.HTTP_201_CREATED,
        )


class FormDetailView(AdminView):
    @extend_schema(responses=s.FormVersionSerializer)
    def get(self, request, public_id):
        return Response(
            s.FormVersionSerializer(selectors.get_form_version(public_id=public_id)).data
        )

    @extend_schema(request=s.FormUpdateSerializer, responses=s.FormVersionSerializer)
    def patch(self, request, public_id):
        data = s.FormUpdateSerializer(data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        values = dict(data.validated_data)
        criteria = values.pop("criteria", None)
        services.update_form_version(
            actor=request.user,
            form=selectors.get_form_version(public_id=public_id),
            criteria=[str(u) for u in criteria] if criteria is not None else None,
            **values,
        )
        return Response(
            s.FormVersionSerializer(selectors.get_form_version(public_id=public_id)).data
        )


class FormPublishView(AdminView):
    @extend_schema(request=None, responses=s.FormVersionSerializer)
    def post(self, request, public_id):
        services.publish_form_version(
            actor=request.user, form=selectors.get_form_version(public_id=public_id)
        )
        return Response(
            s.FormVersionSerializer(selectors.get_form_version(public_id=public_id)).data
        )


# Cycles ----------------------------------------------------------------------
class CycleListView(AdminView, ListAPIView):
    serializer_class = s.CycleSerializer

    def get_queryset(self):
        return selectors.list_cycles()

    @extend_schema(request=s.CycleWriteSerializer, responses={201: s.CycleSerializer})
    def post(self, request):
        data = s.CycleWriteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = dict(data.validated_data)
        values["form_version_id"] = _form_pk(values.pop("form_version"))
        cycle = services.create_cycle(actor=request.user, **values)
        return Response(
            s.CycleSerializer(selectors.get_cycle(public_id=cycle.public_id)).data,
            status=status.HTTP_201_CREATED,
        )


class CycleDetailView(AdminView):
    @extend_schema(responses=s.CycleSerializer)
    def get(self, request, public_id):
        return Response(s.CycleSerializer(selectors.get_cycle(public_id=public_id)).data)

    @extend_schema(request=s.CycleUpdateSerializer, responses=s.CycleSerializer)
    def patch(self, request, public_id):
        data = s.CycleUpdateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = dict(data.validated_data)
        if "form_version" in values:
            values["form_version_id"] = _form_pk(values.pop("form_version"))
        services.update_cycle(
            actor=request.user, cycle=selectors.get_cycle(public_id=public_id), **values
        )
        return Response(s.CycleSerializer(selectors.get_cycle(public_id=public_id)).data)


def _transition(name: str):
    action = getattr(services, f"{name}_cycle")

    class TransitionView(AdminView):
        @extend_schema(
            request=None, responses=s.CycleSerializer, operation_id=f"admin_cycle_{name}"
        )
        def post(self, request, public_id):
            cycle = action(actor=request.user, cycle=selectors.get_cycle(public_id=public_id))
            return Response(s.CycleSerializer(selectors.get_cycle(public_id=cycle.public_id)).data)

    TransitionView.__name__ = f"Cycle{name.title()}View"
    return TransitionView


CycleOpenView = _transition("open")
CycleCloseView = _transition("close")
CycleArchiveView = _transition("archive")


# Evaluations browser & moderation (ADM-02/03/05) ------------------------------------------
_FILTER_PARAMS = [
    OpenApiParameter("recipient", str),
    OpenApiParameter("evaluator", str),
    OpenApiParameter("cycle", str),
    OpenApiParameter("criterion", str),
    OpenApiParameter("rating_min", float),
    OpenApiParameter("rating_max", float),
    OpenApiParameter("submitted_from", str),
    OpenApiParameter("submitted_to", str),
    OpenApiParameter("moderation", str, description="VISIBLE, FLAGGED, HIDDEN or attention"),
    OpenApiParameter("edited", bool),
    OpenApiParameter("evaluation_type", str, description="all, self, or peer"),
]


def _jsonable(filters: dict) -> dict:
    return {k: str(v) for k, v in filters.items() if v not in (None, "")}


class _AuditedListView(AdminView, ListAPIView):
    """Lists that reveal evaluator identities: each page served is logged (ADM-03)."""

    serializer_class = s.AdminEvaluationSerializer
    audit_view = ""

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        services.record_identity_access(
            actor=request.user,
            view=self.audit_view,
            filters=self.audit_filters,
            page=request.query_params.get("page", "1"),
            results=len(response.data.get("results", [])),
        )
        return response


class AdminEvaluationListView(_AuditedListView):
    audit_view = "evaluations.list"

    @extend_schema(parameters=_FILTER_PARAMS)
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        filters = s.AdminEvaluationFilterSerializer(data=self.request.query_params)
        filters.is_valid(raise_exception=True)
        values = dict(filters.validated_data)
        self.audit_filters = _jsonable(values)
        for key in ("recipient", "evaluator", "cycle", "criterion", "evaluation_type"):
            values[key] = str(values.get(key) or "")
        return selectors.admin_list_evaluations(**values)


class ModerationQueueView(_AuditedListView):
    audit_view = "evaluations.moderation_queue"
    audit_filters: dict = {}

    def get_queryset(self):
        return selectors.moderation_queue()


class AdminEvaluationDetailView(AdminView):
    @extend_schema(responses=s.AdminEvaluationDetailSerializer)
    def get(self, request, public_id):
        evaluation = selectors.admin_get_evaluation(public_id=public_id)
        services.record_identity_access(
            actor=request.user, view="evaluations.detail", evaluation=evaluation
        )
        return Response(s.AdminEvaluationDetailSerializer(evaluation).data)


class AdminEvaluationRevisionsView(AdminView):
    @extend_schema(responses=s.AdminRevisionSerializer(many=True))
    def get(self, request, public_id):
        evaluation = selectors.admin_get_evaluation(public_id=public_id)
        services.record_identity_access(
            actor=request.user, view="evaluations.revisions", evaluation=evaluation
        )
        revisions = selectors.admin_list_revisions(evaluation=evaluation)
        return Response(s.AdminRevisionSerializer(revisions, many=True).data)


class AdminEvaluationModerateView(AdminView):
    @extend_schema(request=s.ModerateSerializer, responses=s.AdminEvaluationDetailSerializer)
    def post(self, request, public_id):
        data = s.ModerateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        services.moderate(
            actor=request.user,
            evaluation=selectors.admin_get_evaluation(public_id=public_id),
            **data.validated_data,
        )
        evaluation = selectors.admin_get_evaluation(public_id=public_id)
        return Response(s.AdminEvaluationDetailSerializer(evaluation).data)
