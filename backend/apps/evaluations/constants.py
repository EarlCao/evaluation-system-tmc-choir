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


class EvaluationStatus(models.TextChoices):
    SUBMITTED = "SUBMITTED", "Submitted"
    WITHDRAWN = "WITHDRAWN", "Withdrawn"


class ModerationStatus(models.TextChoices):
    VISIBLE = "VISIBLE", "Visible"
    FLAGGED = "FLAGGED", "Flagged for review"
    HIDDEN = "HIDDEN", "Hidden by moderation"


class CommentKind(models.TextChoices):
    COMMENT = "COMMENT", "Comment"
    SUGGESTION = "SUGGESTION", "Suggestion"


class Ineligibility(models.TextChoices):
    """Why the *viewer* cannot evaluate someone. Every reason is about the viewer's own
    situation or public settings, never about other members' activity (Privacy Model)."""

    SELF = "SELF", "You cannot evaluate yourself."
    NOT_A_MEMBER = "NOT_A_MEMBER", "Only choir members can submit evaluations."
    NO_OPEN_CYCLE = "NO_OPEN_CYCLE", "There is no open evaluation period."
    NOT_STARTED = "NOT_STARTED", "The evaluation period has not started yet."
    ENDED = "ENDED", "The evaluation period has ended."
    NOT_EVALUABLE = "NOT_EVALUABLE", "This member is not part of evaluations."
    OUT_OF_SCOPE = "OUT_OF_SCOPE", "In this period you evaluate members of your own voice section."
    ALREADY_EVALUATED = "ALREADY_EVALUATED", "You already evaluated this member in this period."


class ModerationAction(models.TextChoices):
    FLAG = "FLAG", "Flag for review"
    HIDE = "HIDE", "Hide from the recipient"
    RESTORE = "RESTORE", "Restore"


class ModerationTarget(models.TextChoices):
    EVALUATION = "EVALUATION", "Whole evaluation"
    COMMENT = "COMMENT", "Comment"
    SUGGESTION = "SUGGESTION", "Suggestion"
