from django.urls import path

from . import views

app_name = "reports"

urlpatterns = [
    path("dashboard/", views.MemberDashboardView.as_view(), name="dashboard"),
    path("me/export/", views.MyDataExportView.as_view(), name="my-export"),
]
