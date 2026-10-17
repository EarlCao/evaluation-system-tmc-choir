from rest_framework.throttling import UserRateThrottle


class EvaluationSubmitThrottle(UserRateThrottle):
    """Security Model: 30 submissions per hour per user."""

    scope = "evaluation_submit"
