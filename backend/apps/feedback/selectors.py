"""Public read API of the feedback module: what a member may see about feedback they received.

Privacy Model guarantees implemented here:
1. Only whitelisted rows from ``evaluations.selectors.received_*`` (no evaluator columns).
2. Opaque ``feedback_id`` (HMAC), never the evaluation's ``public_id`` or PK.
3. Day-precision dates; neutral ordering (cycle, then feedback_id), never by time.
4. Aggregates suppressed when n < ``min_aggregate_group_size`` (ADR-013).
5. Missing ratings are excluded from averages, never counted as zero (BR-15).
"""

import base64
import hashlib
import hmac
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from django.conf import settings
from django.utils import timezone

from apps.evaluations import selectors as evaluation_selectors
from apps.evaluations.constants import CommentKind
from apps.system.selectors import get_settings

TWO_PLACES = Decimal("0.01")


def feedback_id(evaluation_pk: int, recipient_pk: int) -> str:
    """Stable, non-sequential and not reversible by members (Privacy Model §2)."""
    digest = hmac.new(
        settings.FEEDBACK_ID_KEY.encode(),
        f"{evaluation_pk}:{recipient_pk}".encode(),
        hashlib.sha256,
    ).digest()
    return base64.b32encode(digest).decode()[:16]


def _local_date(moment) -> date:
    return timezone.localtime(moment, ZoneInfo(get_settings().time_zone)).date()


@dataclass(frozen=True)
class FeedbackItem:
    feedback_id: str
    cycle: dict
    date: date
    is_edited: bool
    comment: str
    suggestion: str
    comments: list[dict]


def _visible_rows(recipient, cycle_public_id):
    rows = evaluation_selectors.received_feedback_rows(
        recipient=recipient, cycle_public_id=cycle_public_id
    )
    cycles = evaluation_selectors.cycles_info(ids={r["cycle_id"] for r in rows})
    return rows, cycles


def list_received(
    *, recipient, cycle_public_id=None, date_from: date | None = None, date_to: date | None = None
) -> list[FeedbackItem]:
    """FB-01 / FB-04: comments and suggestions received, anonymised. Evaluations without any
    visible text are not listed (their ratings appear in the summary)."""
    rows, cycles = _visible_rows(recipient, cycle_public_id)
    texts: dict[int, dict[str, str]] = defaultdict(dict)
    entries_by_eval: dict[int, list[dict]] = defaultdict(list)
    for c in evaluation_selectors.received_comment_rows(evaluation_ids=[r["id"] for r in rows]):
        texts[c["evaluation_id"]][c["kind"]] = c["body"]
        key = (
            "comment"
            if c["kind"] == CommentKind.COMMENT
            else ("suggestion" if c["kind"] == CommentKind.SUGGESTION else c["kind"])
        )
        label = c.get("label") or (
            "Comments (Unsay imong ikaingon sa akoa?)"
            if key == "comment"
            else "Suggestions (Unsay imong ikasuggest sa akoa?)"
            if key == "suggestion"
            else key
        )
        entries_by_eval[c["evaluation_id"]].append(
            {"key": key, "label": label, "body": c["body"]}
        )

    items = []
    for row in rows:
        day = _local_date(row["submitted_at"])
        if (date_from and day < date_from) or (date_to and day > date_to):
            continue
        text = texts.get(row["id"], {})
        if not text:
            continue
        cycle = cycles[row["cycle_id"]]
        items.append(
            (
                cycle["starts_at"],
                FeedbackItem(
                    feedback_id=feedback_id(row["id"], recipient.pk),
                    cycle={"public_id": cycle["public_id"], "name": cycle["name"]},
                    date=day,
                    is_edited=row["is_edited"],
                    comment=text.get(CommentKind.COMMENT, ""),
                    suggestion=text.get(CommentKind.SUGGESTION, ""),
                    comments=entries_by_eval.get(row["id"], []),
                ),
            )
        )
    # Newest cycle first; inside a cycle the opaque id gives a stable, time-neutral order.
    items.sort(key=lambda pair: (-pair[0].timestamp(), pair[1].feedback_id))
    return [item for _starts, item in items]


def count_received(*, recipient, cycle_public_id=None) -> int:
    """FB-03: number of evaluations received (always shown, no threshold)."""
    return len(
        evaluation_selectors.received_feedback_rows(
            recipient=recipient, cycle_public_id=cycle_public_id
        )
    )


def _round(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def summary(*, recipient, cycle_public_id=None, criterion_public_id=None) -> dict:
    """FB-03 / REP-02 / REP-04 / REP-06: per-criterion aggregates + per-cycle trend, each
    suppressed below the privacy threshold."""
    threshold = get_settings().min_aggregate_group_size
    rows, cycles = _visible_rows(recipient, cycle_public_id)
    cycle_of = {r["id"]: r["cycle_id"] for r in rows}
    ratings = evaluation_selectors.received_rating_rows(evaluation_ids=list(cycle_of))
    versions = evaluation_selectors.criterion_versions_info(
        ids={r["criterion_version_id"] for r in ratings}
    )

    values_by_version: dict[int, list[Decimal]] = defaultdict(list)
    percents_by_cycle: dict[int, list[Decimal]] = defaultdict(list)
    for r in ratings:
        if r["value"] is None:
            continue  # not rated ≠ zero (BR-15)
        info = versions[r["criterion_version_id"]]
        if criterion_public_id and str(info["criterion__public_id"]) != str(criterion_public_id):
            continue
        values_by_version[r["criterion_version_id"]].append(r["value"])
        span = info["max_value"] - info["min_value"]
        percents_by_cycle[cycle_of[r["evaluation_id"]]].append(
            (r["value"] - info["min_value"]) / span * 100
        )

    criteria = []
    for version_id, values in values_by_version.items():
        info = versions[version_id]
        entry = {
            "criterion": info["name"],
            "criterion_public_id": info["criterion__public_id"],
            "scale": {
                "type": info["scale_type"],
                "min": info["min_value"],
                "max": info["max_value"],
                "step": info["step"],
            },
            "n": len(values),
            "suppressed": len(values) < threshold,
            "average": None,
            "distribution": None,
        }
        if not entry["suppressed"]:
            entry["average"] = _round(sum(values) / len(values))
            distribution: dict[str, int] = defaultdict(int)
            for v in values:
                distribution[format(v.normalize(), "f")] += 1
            entry["distribution"] = dict(
                sorted(distribution.items(), key=lambda kv: Decimal(kv[0]))
            )
        criteria.append((info["criterion__sort_order"], info["name"], entry))
    criteria.sort(key=lambda t: (t[0], t[1]))

    evaluations_per_cycle: dict[int, int] = defaultdict(int)
    for r in rows:
        evaluations_per_cycle[r["cycle_id"]] += 1
    trend = []
    for cycle_id, count in evaluations_per_cycle.items():
        cycle = cycles[cycle_id]
        percents = percents_by_cycle.get(cycle_id, [])
        suppressed = count < threshold or not percents
        trend.append(
            {
                "cycle": {"public_id": cycle["public_id"], "name": cycle["name"]},
                "evaluations": count,
                "suppressed": suppressed,
                "average_percent": None if suppressed else _round(sum(percents) / len(percents)),
                "_starts": cycle["starts_at"],
            }
        )
    trend.sort(key=lambda t: t["_starts"])
    for t in trend:
        del t["_starts"]

    return {
        "evaluations_received": len(rows),
        "threshold": threshold,
        "criteria": [entry for _o, _n, entry in criteria],
        "trend": trend,
    }
