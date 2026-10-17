from django.db import models


class NotificationType(models.TextChoices):
    FEEDBACK_AVAILABLE = "FEEDBACK_AVAILABLE", "New feedback"
    CYCLE_OPENED = "CYCLE_OPENED", "Evaluation period opened"
    CYCLE_CLOSED = "CYCLE_CLOSED", "Evaluation period closed"
    OWN_EVALUATION_EDITED = "OWN_EVALUATION_EDITED", "Your evaluation was edited"
    ACCOUNT_APPROVED = "ACCOUNT_APPROVED", "Account approved"
    # Super Admin only
    REGISTRATION_PENDING = "REGISTRATION_PENDING", "Registration awaiting approval"
    UNUSUAL_ACTIVITY = "UNUSUAL_ACTIVITY", "Unusual activity"
    CYCLE_COMPLETED = "CYCLE_COMPLETED", "Evaluation period completed"


MESSAGE_MAX = 200
LINK_MAX = 200
