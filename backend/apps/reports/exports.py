"""Render report documents as CSV, Excel or PDF (ADM-07, ADR-018).

A report is a ``Document`` of titled tables. Renderers never interpret cell content:
* CSV / XLSX: text that a spreadsheet would run as a formula (= + - @, tab, CR) is prefixed
  with an apostrophe (OWASP "CSV injection"); numbers stay numbers.
* PDF: text is XML-escaped before it reaches reportlab's paragraph markup parser (shown as
  written: a PDF has no formulas).
"""

import csv
import io
from dataclasses import dataclass, field
from decimal import Decimal
from xml.sax.saxutils import escape

from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Font
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, TableStyle
from reportlab.platypus import Table as PdfTable

FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")

CONTENT_TYPES = {
    "csv": "text/csv; charset=utf-8",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}


@dataclass
class Table:
    title: str
    columns: list[str]
    rows: list[list]
    note: str = ""


@dataclass
class Document:
    title: str
    filename_stem: str  # never contains personal names
    details: list[str] = field(default_factory=list)
    tables: list[Table] = field(default_factory=list)

    @property
    def row_count(self) -> int:
        return sum(len(t.rows) for t in self.tables)


def safe_text(value) -> str:
    text = "" if value is None else str(value)
    return f"'{text}" if text.startswith(FORMULA_PREFIXES) else text


def _cell(value):
    """Numbers and booleans keep their type; everything else becomes neutralised text."""
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, int | float):
        return value
    if isinstance(value, Decimal):
        return float(value)
    return safe_text(value)


def _generated() -> str:
    return f"Generated {timezone.now():%Y-%m-%d %H:%M} UTC"


def to_csv(doc: Document) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([safe_text(doc.title)])
    for line in [*doc.details, _generated()]:
        writer.writerow([safe_text(line)])
    for table in doc.tables:
        writer.writerow([])
        writer.writerow([safe_text(table.title)])
        if table.note:
            writer.writerow([safe_text(table.note)])
        writer.writerow([safe_text(c) for c in table.columns])
        writer.writerows([[_cell(v) for v in row] for row in table.rows])
    # BOM so that Excel opens UTF-8 (accented names) correctly.
    return buffer.getvalue().encode("utf-8-sig")


def _sheet_title(title: str, used: set[str]) -> str:
    cleaned = "".join(ch for ch in title if ch not in "[]:*?/\\")[:31] or "Sheet"
    candidate, n = cleaned, 2
    while candidate in used:
        suffix = f" ({n})"
        candidate, n = cleaned[: 31 - len(suffix)] + suffix, n + 1
    used.add(candidate)
    return candidate


def to_xlsx(doc: Document) -> bytes:
    workbook = Workbook()
    workbook.remove(workbook.active)
    used: set[str] = set()
    for table in doc.tables or [Table(title=doc.title, columns=[], rows=[])]:
        sheet = workbook.create_sheet(_sheet_title(table.title, used))
        sheet.append([safe_text(doc.title)])
        sheet["A1"].font = Font(bold=True, size=13)
        for line in [*doc.details, _generated()]:
            sheet.append([safe_text(line)])
        if table.note:
            sheet.append([safe_text(table.note)])
        sheet.append([])
        sheet.append([safe_text(c) for c in table.columns])
        for cell in sheet[sheet.max_row]:
            cell.font = Font(bold=True)
        header_row = sheet.max_row
        for row in table.rows:
            sheet.append([_cell(v) for v in row])
        for cell in sheet.iter_rows(min_row=header_row + 1):
            for c in cell:
                if isinstance(c.value, str):
                    c.data_type = "s"  # belt and braces: never a formula
        sheet.freeze_panes = sheet.cell(row=header_row + 1, column=1)
        for index, column in enumerate(table.columns, start=1):
            width = max([len(str(column))] + [len(str(r[index - 1] or "")) for r in table.rows])
            sheet.column_dimensions[sheet.cell(row=1, column=index).column_letter].width = min(
                max(width + 2, 10), 60
            )
    out = io.BytesIO()
    workbook.save(out)
    return out.getvalue()


def to_pdf(doc: Document) -> bytes:
    wide = any(len(t.columns) > 6 for t in doc.tables)
    pagesize = landscape(A4) if wide else A4
    styles = getSampleStyleSheet()
    cell_style = styles["BodyText"].clone("cell", fontSize=8, leading=10)
    head_style = cell_style.clone("head", fontName="Helvetica-Bold")

    def para(value, style=cell_style):
        # A PDF never evaluates formulas, so the text is shown as written (escaped markup).
        if isinstance(value, bool):
            value = "yes" if value else "no"
        return Paragraph(escape("" if value is None else str(value)), style)

    story = [Paragraph(escape(doc.title), styles["Title"])]
    for line in [*doc.details, _generated()]:
        story.append(Paragraph(escape(line), styles["Normal"]))
    for table in doc.tables:
        story += [Spacer(1, 6 * mm), Paragraph(escape(table.title), styles["Heading2"])]
        if table.note:
            story.append(Paragraph(escape(table.note), styles["Italic"]))
        if not table.rows:
            story.append(Paragraph("No data.", styles["Normal"]))
            continue
        data = [[para(c, head_style) for c in table.columns]]
        data += [[para(v) for v in row] for row in table.rows]
        pdf_table = PdfTable(data, repeatRows=1, hAlign="LEFT")
        pdf_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef2f7")),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#c7ced8")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        story.append(pdf_table)
    out = io.BytesIO()
    SimpleDocTemplate(
        out,
        pagesize=pagesize,
        title=doc.title,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    ).build(story)
    return out.getvalue()


RENDERERS = {"csv": to_csv, "xlsx": to_xlsx, "pdf": to_pdf}


def render(doc: Document, file_type: str) -> bytes:
    return RENDERERS[file_type](doc)
