"""Builders for evaluation configuration (use services so rules and events stay real)."""

from datetime import timedelta
from itertools import count

from django.utils import timezone

from apps.evaluations import services
from apps.evaluations.constants import ScaleType
from apps.evaluations.defaults import FIVE_POINT_LABELS

_seq = count(1)


def make_criterion(actor=None, **overrides):
    n = next(_seq)
    data = {
        "name": f"Criterion {n}",
        "description": "",
        "scale_type": ScaleType.NUMERIC,
        "min_value": 1,
        "max_value": 5,
        "step": 1,
        "labels": FIVE_POINT_LABELS,
        "is_required": True,
    }
    data.update(overrides)
    return services.create_criterion(actor=actor, **data)


def make_form(actor=None, criteria=None, publish=True, **overrides):
    criteria = criteria or [make_criterion(actor), make_criterion(actor)]
    form = services.create_form_version(
        actor=actor,
        title=overrides.pop("title", f"Form {next(_seq)}"),
        criteria=[str(c.public_id) for c in criteria],
        **overrides,
    )
    if publish:
        services.publish_form_version(actor=actor, form=form)
        form.refresh_from_db()
    return form


def make_cycle(actor=None, form=None, open=False, **overrides):
    now = timezone.now()
    values = {
        "name": f"Cycle {next(_seq)}",
        "starts_at": now - timedelta(days=1),
        "ends_at": now + timedelta(days=14),
        "form_version_id": (form or make_form(actor)).pk,
    }
    values.update(overrides)
    cycle = services.create_cycle(actor=actor, **values)
    if open:
        cycle = services.open_cycle(actor=actor, cycle=cycle)
    return cycle
