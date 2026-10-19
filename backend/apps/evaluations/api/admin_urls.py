from django.urls import path

from . import admin_views as v

app_name = "evaluations-admin"

urlpatterns = [
    path("criterion-categories/", v.CategoryListView.as_view(), name="categories"),
    path("criterion-categories/<int:pk>/", v.CategoryDetailView.as_view(), name="category"),
    path("criteria/", v.CriterionListView.as_view(), name="criteria"),
    path("criteria/reorder/", v.CriterionReorderView.as_view(), name="criteria-reorder"),
    path("criteria/<uuid:public_id>/", v.CriterionDetailView.as_view(), name="criterion"),
    path(
        "criteria/<uuid:public_id>/archive/",
        v.CriterionArchiveView.as_view(),
        name="criterion-archive",
    ),
    path(
        "criteria/<uuid:public_id>/versions/",
        v.CriterionVersionsView.as_view(),
        name="criterion-versions",
    ),
    path("comment-prompts/", v.CommentPromptListView.as_view(), name="comment-prompts"),
    path(
        "comment-prompts/reorder/",
        v.CommentPromptReorderView.as_view(),
        name="comment-prompts-reorder",
    ),
    path(
        "comment-prompts/<uuid:public_id>/",
        v.CommentPromptDetailView.as_view(),
        name="comment-prompt",
    ),
    path(
        "comment-prompts/<uuid:public_id>/archive/",
        v.CommentPromptArchiveView.as_view(),
        name="comment-prompt-archive",
    ),
    path("form-versions/", v.FormListView.as_view(), name="forms"),
    path("form-versions/<uuid:public_id>/", v.FormDetailView.as_view(), name="form"),
    path(
        "form-versions/<uuid:public_id>/publish/", v.FormPublishView.as_view(), name="form-publish"
    ),
    path("evaluation-cycles/", v.CycleListView.as_view(), name="cycles"),
    path("evaluation-cycles/<uuid:public_id>/", v.CycleDetailView.as_view(), name="cycle"),
    path("evaluation-cycles/<uuid:public_id>/open/", v.CycleOpenView.as_view(), name="cycle-open"),
    path(
        "evaluation-cycles/<uuid:public_id>/close/", v.CycleCloseView.as_view(), name="cycle-close"
    ),
    path(
        "evaluation-cycles/<uuid:public_id>/archive/",
        v.CycleArchiveView.as_view(),
        name="cycle-archive",
    ),
    path("evaluations/", v.AdminEvaluationListView.as_view(), name="evaluations"),
    path("evaluations/<uuid:public_id>/", v.AdminEvaluationDetailView.as_view(), name="evaluation"),
    path(
        "evaluations/<uuid:public_id>/revisions/",
        v.AdminEvaluationRevisionsView.as_view(),
        name="evaluation-revisions",
    ),
    path(
        "evaluations/<uuid:public_id>/moderate/",
        v.AdminEvaluationModerateView.as_view(),
        name="evaluation-moderate",
    ),
    path("moderation-queue/", v.ModerationQueueView.as_view(), name="moderation-queue"),
]
