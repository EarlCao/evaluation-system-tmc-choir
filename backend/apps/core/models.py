"""Abstract base models shared by every module."""

import uuid

from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class PublicIdModel(models.Model):
    """Adds a non-sequential identifier for URLs and API payloads (never expose integer PKs)."""

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    class Meta:
        abstract = True


class AppendOnlyViolation(RuntimeError):
    """Raised when code tries to modify or delete an append-only record."""


class AppendOnlyQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise AppendOnlyViolation(f"{self.model.__name__} rows cannot be updated.")

    def bulk_update(self, objs, fields, batch_size=None):
        raise AppendOnlyViolation(f"{self.model.__name__} rows cannot be updated.")

    def delete(self):
        raise AppendOnlyViolation(f"{self.model.__name__} rows cannot be deleted.")


class AppendOnlyModel(models.Model):
    """Rows can be inserted but never updated or deleted (audit log, revisions, moderation).

    Concrete subclasses must use ``on_delete=models.PROTECT`` for their foreign keys so a
    cascade can never remove them.
    """

    objects = AppendOnlyQuerySet.as_manager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise AppendOnlyViolation(f"{type(self).__name__} rows cannot be updated.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise AppendOnlyViolation(f"{type(self).__name__} rows cannot be deleted.")
