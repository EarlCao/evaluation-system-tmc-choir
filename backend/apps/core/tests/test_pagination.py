from rest_framework.permissions import AllowAny
from rest_framework.test import APIRequestFactory
from rest_framework.views import APIView

from apps.core.pagination import DefaultPagination

factory = APIRequestFactory()


class NumbersView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(list(range(250)), request, view=self)
        return paginator.get_paginated_response(page)


def get(query: str = ""):
    return NumbersView.as_view()(factory.get(f"/numbers/{query}"))


def test_default_page_size_and_envelope():
    data = get().data
    assert set(data) == {"count", "next", "previous", "results"}
    assert data["count"] == 250
    assert len(data["results"]) == 20
    assert data["previous"] is None
    assert "page=2" in data["next"]


def test_page_size_query_param_is_capped_at_100():
    assert len(get("?page_size=500").data["results"]) == 100


def test_requested_page():
    assert get("?page=3").data["results"][0] == 40
