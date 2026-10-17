from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """``{count, next, previous, results}``; ``?page=`` and ``?page_size=`` (max 100)."""

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
