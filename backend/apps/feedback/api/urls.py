from django.urls import path

from . import views

app_name = "feedback"

urlpatterns = [
    path("received/", views.ReceivedFeedbackView.as_view(), name="received"),
    path("received/summary/", views.FeedbackSummaryView.as_view(), name="summary"),
    path("received/count/", views.FeedbackCountView.as_view(), name="count"),
]
