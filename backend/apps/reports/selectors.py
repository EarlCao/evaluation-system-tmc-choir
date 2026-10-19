"""Public read API of the reports module."""

from collections import defaultdict
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from apps.accounts import selectors as account_selectors
from apps.evaluations import selectors as evaluation_selectors
from apps.feedback import selectors as feedback_selectors
from apps.members import selectors as member_selectors
from apps.system.selectors import get_settings


def member_dashboard(*, user) -> dict:
    """Numbers for the member dashboard."""
    profile = member_selectors.get_own_profile(user=user)
    cycle = evaluation_selectors.get_open_cycle()
    open_cycle = None
    if cycle is not None:
        open_cycle = {
            "public_id": cycle.public_id,
            "name": cycle.name,
            "ends_at": cycle.ends_at,
            "evaluations_given": evaluation_selectors.count_my_evaluations(user=user, cycle=cycle),
            "members_left": evaluation_selectors.count_members_left_to_evaluate(
                user=user, cycle=cycle
            ),
        }
    return {
        "active_members": member_selectors.count_active_members(),
        "voice_section": profile.voice_section.name if profile else None,
        "open_cycle": open_cycle,
        "feedback_received": feedback_selectors.count_received(recipient=user),
    }


def admin_dashboard() -> dict:
    """ADM-01: system-wide statistics for the Super Admin."""
    members = account_selectors.count_members_by_status()
    cycle = evaluation_selectors.get_open_cycle()
    open_cycle = None
    if cycle is not None:
        open_cycle = {
            "public_id": cycle.public_id,
            "name": cycle.name,
            "starts_at": cycle.starts_at,
            "ends_at": cycle.ends_at,
            "evaluation_scope": cycle.evaluation_scope,
            "evaluations_submitted": evaluation_selectors.count_submitted_evaluations(cycle=cycle),
            **evaluation_selectors.cycle_participation(cycle=cycle),
        }
    return {
        "members": {
            "registered": sum(members.values()),
            "active": members["ACTIVE"],
            "pending": members["PENDING"],
            "suspended": members["SUSPENDED"],
            "deactivated": members["DEACTIVATED"],
        },
        "evaluations_submitted": evaluation_selectors.count_submitted_evaluations(),
        "needs_moderation": evaluation_selectors.count_needing_moderation(),
        "cycles": evaluation_selectors.count_cycles_by_status(),
        "open_cycle": open_cycle,
    }


# Admin reports (REP-01..06, step 4.5) -----------------------------------------------------
TWO_PLACES = Decimal("0.01")


def _round(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def _mean(values: list[Decimal]) -> Decimal | None:
    return _round(sum(values) / len(values)) if values else None


def _percent(value: Decimal, info: dict) -> Decimal:
    """Position on the criterion's own scale, 0-100, so different scales can be combined."""
    return (value - info["min_value"]) / (info["max_value"] - info["min_value"]) * 100


def _ratings(rows: list[dict], criterion: str = "") -> tuple[list[dict], dict[int, dict]]:
    ratings = evaluation_selectors.received_rating_rows(evaluation_ids=[r["id"] for r in rows])
    versions = evaluation_selectors.criterion_versions_info(
        ids={r["criterion_version_id"] for r in ratings}
    )
    if criterion:
        ratings = [
            r
            for r in ratings
            if str(versions[r["criterion_version_id"]]["criterion__public_id"]) == str(criterion)
        ]
    return ratings, versions


def _criteria_table(ratings: list[dict], versions: dict[int, dict], threshold: int) -> list[dict]:
    """One entry per criterion *version* (a scale change makes a new version, BR-07).
    Not rated is counted separately and never averaged as zero (BR-15, REP-04)."""
    rated: dict[int, list[Decimal]] = defaultdict(list)
    not_rated: dict[int, int] = defaultdict(int)
    for r in ratings:
        if r["value"] is None:
            not_rated[r["criterion_version_id"]] += 1
        else:
            rated[r["criterion_version_id"]].append(r["value"])
    entries = []
    for version_id in set(rated) | set(not_rated):
        info, values = versions[version_id], rated.get(version_id, [])
        suppressed = len(values) < threshold
        entries.append(
            {
                "criterion": info["name"],
                "criterion_public_id": info["criterion__public_id"],
                "version": info["version"],
                "scale": {
                    "type": info["scale_type"],
                    "min": info["min_value"],
                    "max": info["max_value"],
                    "step": info["step"],
                },
                "rated": len(values),
                "not_rated": not_rated.get(version_id, 0),
                "suppressed": suppressed,
                "average": None if suppressed else _mean(values),
                "average_percent": (
                    None if suppressed else _mean([_percent(v, info) for v in values])
                ),
                "_order": (info["criterion__sort_order"], info["name"], info["version"]),
            }
        )
    entries.sort(key=lambda e: e["_order"])
    for e in entries:
        del e["_order"]
    return entries


def _percents_by(rows: list[dict], ratings: list[dict], versions, key: str) -> dict:
    group_of = {r["id"]: r[key] for r in rows}
    out: dict = defaultdict(list)
    for r in ratings:
        if r["value"] is not None:
            out[group_of[r["evaluation_id"]]].append(
                _percent(r["value"], versions[r["criterion_version_id"]])
            )
    return out


def _trend(rows: list[dict], ratings, versions, threshold: int) -> list[dict]:
    """Per cycle, oldest first: evaluations, distinct evaluators and the average position on
    the scale (suppressed below the threshold of distinct evaluators)."""
    cycles = evaluation_selectors.cycles_info(ids={r["cycle_id"] for r in rows})
    percents = _percents_by(rows, ratings, versions, "cycle_id")
    trend = []
    for cycle_id, cycle in cycles.items():
        cycle_rows = [r for r in rows if r["cycle_id"] == cycle_id]
        evaluators = len({r["evaluator_id"] for r in cycle_rows})
        suppressed = evaluators < threshold
        trend.append(
            {
                "cycle": {"public_id": cycle["public_id"], "name": cycle["name"]},
                "evaluations": len(cycle_rows),
                "evaluators": evaluators,
                "suppressed": suppressed,
                "average_percent": None if suppressed else _mean(percents.get(cycle_id, [])),
                "_starts": cycle["starts_at"],
            }
        )
    trend.sort(key=lambda t: t["_starts"])
    for t in trend:
        del t["_starts"]
    return trend


def choir_summary(
    *,
    cycle: str = "",
    submitted_from: date | None = None,
    submitted_to: date | None = None,
    voice_section: int | None = None,
    criterion: str = "",
) -> dict:
    """REP-01 / REP-03 / REP-06: choir-wide aggregates. No identities. Every breakdown is
    suppressed when fewer than ``min_aggregate_group_size`` members are behind it."""
    threshold = get_settings().min_aggregate_group_size
    rows = evaluation_selectors.report_evaluation_rows(
        cycle=cycle,
        submitted_from=submitted_from,
        submitted_to=submitted_to,
        voice_section=voice_section,
    )
    ratings, versions = _ratings(rows, criterion)
    section_percents = _percents_by(
        rows, ratings, versions, "recipient__member_profile__voice_section_id"
    )
    sections = []
    for section in member_selectors.admin_list_voice_sections():
        section_rows = [
            r for r in rows if r["recipient__member_profile__voice_section_id"] == section.pk
        ]
        if not section_rows:
            continue
        evaluators = len({r["evaluator_id"] for r in section_rows})
        suppressed = evaluators < threshold
        sections.append(
            {
                "id": section.pk,
                "name": section.name,
                "evaluations": len(section_rows),
                "recipients": len({r["recipient_id"] for r in section_rows}),
                "evaluators": evaluators,
                "suppressed": suppressed,
                "average_percent": (
                    None if suppressed else _mean(section_percents.get(section.pk, []))
                ),
            }
        )
    return {
        "threshold": threshold,
        "totals": {
            "evaluations": len(rows),
            "evaluators": len({r["evaluator_id"] for r in rows}),
            "recipients": len({r["recipient_id"] for r in rows}),
        },
        "criteria": _criteria_table(ratings, versions, threshold),
        "voice_sections": sections,
        "trend": _trend(rows, ratings, versions, threshold),
    }


def member_summary(
    *,
    public_id,
    cycle: str = "",
    submitted_from: date | None = None,
    submitted_to: date | None = None,
) -> dict:
    """REP-01 / REP-02: one member, Super Admin variant. Aggregates only (the evaluations
    browser shows who wrote what); not suppressed, but every figure carries its n."""
    user = member_selectors.admin_get_member(public_id=public_id)
    window = {"cycle": cycle, "submitted_from": submitted_from, "submitted_to": submitted_to}
    received = evaluation_selectors.report_evaluation_rows(recipient=user, **window)
    given = evaluation_selectors.report_evaluation_rows(evaluator=user, **window)
    ratings, versions = _ratings(received)
    profile = getattr(user, "member_profile", None)
    return {
        "member": {
            "public_id": user.public_id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "voice_section": profile.voice_section.name if profile else None,
            "status": user.status,
        },
        "evaluations_received": len(received),
        "evaluations_given": len(given),
        "criteria": _criteria_table(ratings, versions, threshold=0),
        "trend": _trend(received, ratings, versions, threshold=0),
    }


def participation_report(*, cycle_public_id) -> dict:
    """REP-01 / REP-04: per member, who took part in a cycle. Evaluator-level: admin only."""
    cycle = evaluation_selectors.get_cycle(public_id=cycle_public_id)
    per_member = evaluation_selectors.participation_by_member(cycle=cycle)
    profiles = member_selectors.active_profiles().order_by(
        "voice_section__sort_order", "user__last_name", "user__first_name", "user__id"
    )
    members = []
    for p in profiles:
        stats = per_member.get(p.user_id)
        if stats is None:
            continue
        members.append(
            {
                "public_id": p.user.public_id,
                "first_name": p.user.first_name,
                "last_name": p.user.last_name,
                "voice_section": p.voice_section.name,
                "is_evaluable": p.is_evaluable,
                **stats,
                "percent": (
                    round(stats["given"] / stats["possible"] * 100, 1)
                    if stats["possible"]
                    else None
                ),
            }
        )
    return {
        "cycle": {
            "public_id": cycle.public_id,
            "name": cycle.name,
            "status": cycle.status,
            "evaluation_scope": cycle.evaluation_scope,
        },
        "totals": evaluation_selectors.cycle_participation(cycle=cycle),
        "members": members,
    }


def own_data_export(*, user) -> dict:
    """Step 6.4: complete export of a member's own data (account, choir profile, evaluations
    written by this member, and anonymised feedback received)."""
    profile = member_selectors.get_own_profile(user=user)
    given = []
    for ev in evaluation_selectors.list_my_evaluations(user=user):
        comments = {c.kind: c.body for c in ev.comments.all()}
        given.append(
            {
                "public_id": str(ev.public_id),
                "cycle": {
                    "public_id": str(ev.cycle.public_id),
                    "name": ev.cycle.name,
                },
                "recipient": {
                    "public_id": str(ev.recipient.public_id),
                    "first_name": ev.recipient.first_name,
                    "last_name": ev.recipient.last_name,
                },
                "submitted_at": ev.submitted_at.isoformat(),
                "last_edited_at": ev.last_edited_at.isoformat() if ev.last_edited_at else None,
                "is_edited": ev.is_edited,
                "ratings": [
                    {
                        "criterion": r.criterion_version.name,
                        "value": str(r.value) if r.value is not None else None,
                        "label": r.label,
                    }
                    for r in ev.ratings.all()
                ],
                "comment": comments.get("COMMENT", ""),
                "suggestion": comments.get("SUGGESTION", ""),
            }
        )
    received_items = [
        {
            "feedback_id": item.feedback_id,
            "cycle": {
                "public_id": str(item.cycle["public_id"]),
                "name": item.cycle["name"],
            },
            "date": item.date.isoformat(),
            "is_edited": item.is_edited,
            "comment": item.comment,
            "suggestion": item.suggestion,
        }
        for item in feedback_selectors.list_received(recipient=user)
    ]
    return {
        "account": {
            "public_id": str(user.public_id),
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "display_name": user.display_name,
            "role": user.role,
            "status": user.status,
            "date_joined": user.date_joined.isoformat(),
        },
        "member_profile": (
            {
                "voice_section": profile.voice_section.name if profile.voice_section else None,
                "membership_status": getattr(
                    profile, "membership_status", getattr(profile.user, "status", None)
                ),
                "joined_choir_on": (
                    profile.joined_choir_on.isoformat() if profile.joined_choir_on else None
                ),
            }
            if profile
            else None
        ),
        "evaluations_given": given,
        "feedback_received": {
            "items": received_items,
            "summary": feedback_selectors.summary(recipient=user),
        },
    }

