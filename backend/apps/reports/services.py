"""Public write API of the reports module: generating exports (ADM-07).

Every export is recorded synchronously in the audit log (``reports.export.generated``) before
the file is returned, so an export that cannot be audited is not delivered (AUD-01, REP-05).
"""

from dataclasses import dataclass
from datetime import UTC

from django.utils import timezone

from apps.audit import services as audit
from apps.core.exceptions import ValidationError
from apps.core.exports import CONTENT_TYPES, Document, Table, render
from apps.evaluations import selectors as evaluation_selectors
from apps.evaluations.constants import CommentKind

from . import selectors

EXPORT_EVENT = "reports.export.generated"
REPORTS = ("choir", "member", "participation", "evaluations")
FILE_TYPES = tuple(CONTENT_TYPES)
NO_PDF = {"evaluations"}  # too wide for a page; use CSV or Excel


@dataclass(frozen=True)
class ExportFile:
    filename: str
    content_type: str
    content: bytes


def _number(value):
    return "" if value is None else value


def _plain(value) -> str:
    """1.00 → "1", 2.50 → "2.5"."""
    return format(value.normalize(), "f")


def _suppressed(value, suppressed: bool):
    return "hidden (too few)" if suppressed else _number(value)


def _filters_text(filters: dict) -> list[str]:
    shown = {k: v for k, v in filters.items() if v not in (None, "")}
    return [f"Filters: {', '.join(f'{k}={v}' for k, v in shown.items())}"] if shown else []


def _criteria_table(criteria: list[dict], *, threshold: int | None) -> Table:
    note = "Averages leave out 'not rated'; it is never counted as zero."
    if threshold:
        note += f" Figures based on fewer than {threshold} ratings are hidden."
    return Table(
        title="Criteria",
        note=note,
        columns=["Criterion", "Version", "Scale", "Rated", "Not rated", "Average", "Average %"],
        rows=[
            [
                c["criterion"],
                c["version"],
                f"{_plain(c['scale']['min'])}-{_plain(c['scale']['max'])}",
                c["rated"],
                c["not_rated"],
                _suppressed(c["average"], c["suppressed"]),
                _suppressed(c["average_percent"], c["suppressed"]),
            ]
            for c in criteria
        ],
    )


def _trend_table(trend: list[dict]) -> Table:
    return Table(
        title="By period",
        note="Average % = average position on each criterion's scale (0 = lowest, 100 = highest).",
        columns=["Period", "Evaluations", "Evaluators", "Average %"],
        rows=[
            [
                t["cycle"]["name"],
                t["evaluations"],
                t["evaluators"],
                _suppressed(t["average_percent"], t["suppressed"]),
            ]
            for t in trend
        ],
    )


def _choir(filters: dict) -> Document:
    data = selectors.choir_summary(**filters)
    totals = data["totals"]
    return Document(
        title="Choir summary",
        filename_stem="choir-summary",
        details=[
            *_filters_text(filters),
            f"{totals['evaluations']} evaluations by {totals['evaluators']} members "
            f"about {totals['recipients']} members.",
        ],
        tables=[
            _criteria_table(data["criteria"], threshold=data["threshold"]),
            Table(
                title="Voice sections",
                note=f"Sections with fewer than {data['threshold']} evaluators are hidden.",
                columns=["Voice section", "Evaluations", "Members evaluated", "Average %"],
                rows=[
                    [
                        s["name"],
                        s["evaluations"],
                        s["recipients"],
                        _suppressed(s["average_percent"], s["suppressed"]),
                    ]
                    for s in data["voice_sections"]
                ],
            ),
            _trend_table(data["trend"]),
        ],
    )


def _member(filters: dict) -> Document:
    public_id = filters.pop("member", None)
    if not public_id:
        raise ValidationError(fields={"member": ["Choose a member."]})
    data = selectors.member_summary(public_id=public_id, **filters)
    m = data["member"]
    return Document(
        title=f"Member summary: {m['first_name']} {m['last_name']}",
        filename_stem=f"member-summary-{str(m['public_id'])[:8]}",
        details=[
            *_filters_text(filters),
            f"Voice section: {m['voice_section'] or '-'}",
            f"Evaluations received: {data['evaluations_received']} · "
            f"given: {data['evaluations_given']}",
        ],
        tables=[_criteria_table(data["criteria"], threshold=None), _trend_table(data["trend"])],
    )


def _participation(filters: dict) -> Document:
    cycle = filters.get("cycle")
    if not cycle:
        raise ValidationError(fields={"cycle": ["Choose a period."]})
    data = selectors.participation_report(cycle_public_id=cycle)
    totals = data["totals"]
    percent = totals["participation_percent"]
    return Document(
        title=f"Participation: {data['cycle']['name']}",
        filename_stem=f"participation-{str(data['cycle']['public_id'])[:8]}",
        details=[
            f"{totals['submitted_pairs']} of {totals['possible_pairs']} possible evaluations "
            f"({'-' if percent is None else f'{percent}%'}) · "
            f"{totals['participating_members']} members took part.",
            "Possible = the active members each person may evaluate in this period "
            "(themselves excluded). Resubmissions count once.",
        ],
        tables=[
            Table(
                title="Members",
                columns=[
                    "First name",
                    "Last name",
                    "Voice section",
                    "Given",
                    "Possible",
                    "Given %",
                    "Received",
                ],
                rows=[
                    [
                        m["first_name"],
                        m["last_name"],
                        m["voice_section"],
                        m["given"],
                        m["possible"],
                        _number(m["percent"]),
                        m["received"],
                    ]
                    for m in data["members"]
                ],
            )
        ],
    )


def _evaluations(filters: dict) -> Document:
    """The evaluator-detail export (REP-05): identities included, Super Admin only."""
    evaluations = list(evaluation_selectors.admin_list_evaluations(**filters))
    criteria: list[str] = []
    for e in evaluations:
        for r in e.ratings.all():
            if r.criterion_version.name not in criteria:
                criteria.append(r.criterion_version.name)

    def text(e, kind):
        c = next((c for c in e.comments.all() if c.kind == kind), None)
        return ("", "") if c is None else (c.body, c.moderation_status)

    rows = []
    for e in evaluations:
        values = {r.criterion_version.name: _number(r.value) for r in e.ratings.all()}
        comment, comment_status = text(e, CommentKind.COMMENT)
        suggestion, suggestion_status = text(e, CommentKind.SUGGESTION)
        rows.append(
            [
                e.submitted_at.astimezone(UTC).strftime("%Y-%m-%d %H:%M"),
                e.cycle.name,
                f"{e.evaluator.first_name} {e.evaluator.last_name}",
                f"{e.recipient.first_name} {e.recipient.last_name}",
                e.is_edited,
                e.moderation_status,
                *[values.get(name, "") for name in criteria],
                comment,
                comment_status,
                suggestion,
                suggestion_status,
            ]
        )
    return Document(
        title="Evaluations with evaluator identities",
        filename_stem="evaluations-detail",
        details=[
            *_filters_text(filters),
            "CONFIDENTIAL: shows who wrote each evaluation. Do not share with members.",
        ],
        tables=[
            Table(
                title="Evaluations",
                columns=[
                    "Submitted (UTC)",
                    "Period",
                    "Evaluator",
                    "About",
                    "Edited",
                    "Moderation",
                    *criteria,
                    "Comment",
                    "Comment status",
                    "Suggestion",
                    "Suggestion status",
                ],
                rows=rows,
            )
        ],
    )


BUILDERS = {
    "choir": _choir,
    "member": _member,
    "participation": _participation,
    "evaluations": _evaluations,
}


def generate_export(*, actor, report: str, file_type: str, filters: dict) -> ExportFile:
    if report not in BUILDERS:
        raise ValidationError(fields={"report": ["Unknown report."]})
    if file_type not in FILE_TYPES:
        raise ValidationError(fields={"file_type": ["Choose csv, xlsx or pdf."]})
    if file_type == "pdf" and report in NO_PDF:
        raise ValidationError(fields={"file_type": ["This report is available as CSV or Excel."]})
    audited_filters = {k: str(v) for k, v in filters.items() if v not in (None, "")}
    doc = BUILDERS[report](dict(filters))
    content = render(doc, file_type)
    audit.record(
        event_type=EXPORT_EVENT,
        actor=actor,
        target_type="reports.Report",
        target_id=report,
        metadata={
            "report": report,
            "file_type": file_type,
            "filters": audited_filters,
            "rows": doc.row_count,
            "identities": report in ("evaluations", "participation"),
        },
    )
    return ExportFile(
        filename=f"{doc.filename_stem}-{timezone.now():%Y-%m-%d}.{file_type}",
        content_type=CONTENT_TYPES[file_type],
        content=content,
    )


OWN_DATA_EXPORT_EVENT = "accounts.data_export.generated"


def export_own_data(*, user) -> dict:
    """Step 6.4: export a member's own data and record the export in the audit log."""
    data = selectors.own_data_export(user=user)
    audit.record(
        event_type=OWN_DATA_EXPORT_EVENT,
        actor=user,
        target_type="accounts.User",
        target_id=user.pk,
        metadata={
            "evaluations_given": len(data["evaluations_given"]),
            "feedback_items": len(data["feedback_received"]["items"]),
        },
    )
    return data

