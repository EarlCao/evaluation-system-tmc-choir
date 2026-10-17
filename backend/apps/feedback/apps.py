from django.apps import AppConfig


class FeedbackConfig(AppConfig):
    """Anonymised, recipient-facing read model (FB-01..06, ADR-009). No models of its own."""

    name = "apps.feedback"
    label = "feedback"
    verbose_name = "Feedback"
