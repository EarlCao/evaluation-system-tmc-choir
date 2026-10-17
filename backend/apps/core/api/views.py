import logging

from django.db import DatabaseError, connection
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import HealthSerializer

logger = logging.getLogger(__name__)


def _database_ok() -> bool:
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except DatabaseError:
        logger.warning("Health check: database unavailable", exc_info=True)
        return False
    return True


class HealthView(APIView):
    """Liveness/readiness probe. Public, unauthenticated, reveals no details."""

    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(auth=[], responses={200: HealthSerializer, 503: HealthSerializer})
    def get(self, request):
        db_ok = _database_ok()
        body = {"status": "ok" if db_ok else "error", "db": "ok" if db_ok else "error"}
        return Response(
            body, status=status.HTTP_200_OK if db_ok else status.HTTP_503_SERVICE_UNAVAILABLE
        )
