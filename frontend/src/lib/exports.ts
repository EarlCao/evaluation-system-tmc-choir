import { apiUrl } from "./apiClient";

export type ReportKind = "choir" | "member" | "participation" | "evaluations";
export type FileType = "csv" | "xlsx" | "pdf";

/** Report download URL. A plain link: the browser downloads with the session cookie and the
 * server writes the export to the audit log (ADM-07). Empty filter values are left out. */
export function exportUrl(report: ReportKind, fileType: FileType, filters: object = {}): string {
  const params = new URLSearchParams({ report, file_type: fileType });
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === "string" && value) params.set(key, value);
  }
  return apiUrl(`/admin/reports/export/?${params.toString()}`);
}
