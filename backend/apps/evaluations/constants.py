from django.db import models


class ScaleType(models.TextChoices):
    NUMERIC = "NUMERIC", "Points (e.g. 1-5)"
    PERCENT = "PERCENT", "Percentage (0-100)"


class FormStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    PUBLISHED = "PUBLISHED", "Published"


class CycleStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    OPEN = "OPEN", "Open"
    CLOSED = "CLOSED", "Closed"
    ARCHIVED = "ARCHIVED", "Archived"


class EvaluationScope(models.TextChoices):
    """Who may evaluate whom in a cycle (CFG-05, Open Question Q2)."""

    ALL = "ALL", "Everyone evaluates everyone"
    SAME_SECTION = "SAME_SECTION", "Only members of the same voice section"


class FeedbackVisibility(models.TextChoices):
    """When recipients see feedback (Open Question Q4, Privacy Model)."""

    IMMEDIATE = "IMMEDIATE", "As soon as it is submitted"
    AFTER_CLOSE = "AFTER_CLOSE", "When the cycle closes"


CRITERION_NAME_MAX = 100
CRITERION_DESCRIPTION_MAX = 500
LABEL_MAX = 60
MAX_SCALE_POINTS = 101
TEXT_LIMIT_MAX = 5000
DEFAULT_TEXT_LIMIT = 2000
