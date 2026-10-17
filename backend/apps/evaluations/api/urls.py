from django.urls import path

from . import views

app_name = "evaluations"

urlpatterns = [
    path("evaluation-cycles/current/", views.CurrentCycleView.as_view(), name="current-cycle"),
    path(
        "evaluation-cycles/<uuid:public_id>/form/", views.CycleFormView.as_view(), name="cycle-form"
    ),
    path("evaluations/", views.EvaluationCreateView.as_view(), name="submit"),
    path("evaluations/eligibility/", views.EligibilityView.as_view(), name="eligibility"),
    path("evaluations/mine/", views.MyEvaluationListView.as_view(), name="mine"),
    path(
        "evaluations/mine/<uuid:public_id>/",
        views.MyEvaluationDetailView.as_view(),
        name="mine-detail",
    ),
]
