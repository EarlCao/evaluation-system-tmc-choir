import os
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.evaluations import services
from apps.evaluations.constants import FormStatus, ScaleType
from apps.evaluations.defaults import DEFAULT_CATEGORIES, DEFAULT_CRITERIA, FIVE_POINT_LABELS
from apps.evaluations.models import CriterionCategory, EvaluationCycle, FormVersion, RatingCriterion

DEMO_PASSWORD_ENV = "DEMO_MEMBER_PASSWORD"  # noqa: S105 (env var name, not a password)


class Command(BaseCommand):
    help = (
        "Idempotently create the default criteria, a published form and a draft cycle. "
        f"--members N also creates N ACTIVE demo members (password from ${DEMO_PASSWORD_ENV}). "
        "Development only."
    )

    def add_arguments(self, parser):
        parser.add_argument("--members", type=int, default=0)
        parser.add_argument("--open-cycle", action="store_true", help="Open the demo cycle.")

    @transaction.atomic
    def handle(self, *args, **options):
        categories = {}
        for name in DEFAULT_CATEGORIES:
            categories[name] = CriterionCategory.objects.filter(name=name).first() or (
                services.create_category(actor=None, name=name)
            )

        criteria = []
        for key, category, name, description in DEFAULT_CRITERIA:
            criterion = RatingCriterion.objects.filter(
                key=key
            ).first() or services.create_criterion(
                actor=None,
                key=key,
                category_id=categories[category].pk,
                name=name,
                description=description,
                scale_type=ScaleType.NUMERIC,
                min_value=1,
                max_value=5,
                step=1,
                labels=FIVE_POINT_LABELS,
                is_required=True,
            )
            criteria.append(criterion)

        form = FormVersion.objects.filter(title="Standard choir evaluation").first()
        if form is None:
            form = services.create_form_version(
                actor=None,
                title="Standard choir evaluation",
                criteria=[str(c.public_id) for c in criteria],
            )
        if form.status == FormStatus.DRAFT:
            services.publish_form_version(actor=None, form=form)

        cycle = EvaluationCycle.objects.filter(name="Demo cycle").first()
        if cycle is None:
            now = timezone.now()
            cycle = services.create_cycle(
                actor=None,
                name="Demo cycle",
                description="Created by seed_demo_data.",
                starts_at=now - timedelta(days=1),
                ends_at=now + timedelta(days=30),
                form_version_id=form.pk,
            )
        if options["open_cycle"] and cycle.status == "DRAFT":
            services.open_cycle(actor=None, cycle=cycle)

        created = self._members(options["members"])
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(criteria)} criteria, form v{form.version} ({form.status}), "
                f"cycle '{cycle.name}' ({cycle.status}), {created} new demo member(s)."
            )
        )

    def _members(self, count: int) -> int:
        if count <= 0:
            return 0
        password = os.environ.get(DEMO_PASSWORD_ENV)
        if not password:
            raise CommandError(f"Set {DEMO_PASSWORD_ENV} to create demo members.")
        from apps.accounts.constants import UserStatus
        from apps.accounts.models import User
        from apps.members.models import MemberProfile, VoiceSection

        sections = list(VoiceSection.objects.filter(is_active=True))
        created = 0
        for i in range(1, count + 1):
            username = f"demo{i:02d}"
            if User.objects.filter(username=username).exists():
                continue
            user = User.objects.create_user(
                email=f"{username}@example.org",
                username=username,
                password=password,
                first_name=f"Demo{i:02d}",
                last_name="Singer",
                status=UserStatus.ACTIVE,
            )
            MemberProfile.objects.create(user=user, voice_section=sections[i % len(sections)])
            created += 1
        return created
