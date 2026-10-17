from django.db import models

from apps.core.models import AppendOnlyModel, PublicIdModel, TimeStampedModel


class Widget(TimeStampedModel, PublicIdModel):
    name = models.CharField(max_length=50)

    def __str__(self) -> str:
        return self.name


class LogEntry(AppendOnlyModel):
    message = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.message
