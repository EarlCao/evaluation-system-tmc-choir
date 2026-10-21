from django.apps import AppConfig


class EvaluationsConfig(AppConfig):
    """Criteria, form versions, cycles, evaluations, revisions, moderation (EVAL, CFG, MINE)."""

    name = "apps.evaluations"
    label = "evaluations"
    verbose_name = "Evaluations"

    def ready(self):
        from apps.members.selectors import register_evaluation_readers
        from apps.system.services import register_retention_handler

        from . import selectors, services

        register_evaluation_readers(
            directory_enricher=selectors.enrich_member_directory,
            self_evaluation_reader=selectors.get_public_self_evaluation,
        )
        register_retention_handler(services.apply_retention)
