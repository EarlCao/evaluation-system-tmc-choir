import { apiClient } from "@/lib/apiClient";
import type { Paginated } from "@/lib/pagination";

import type { AdminSettings, AuditEntry, AuditFilters, SettingsInput } from "./systemTypes";

export async function fetchAdminSettings(): Promise<AdminSettings> {
  return (await apiClient.get<AdminSettings>("/admin/settings/")).data;
}

export async function updateAdminSettings(input: SettingsInput): Promise<AdminSettings> {
  return (await apiClient.patch<AdminSettings>("/admin/settings/", input)).data;
}

function auditParams(f: AuditFilters): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(f)) {
    if (key !== "page" && typeof value === "string" && value) params[key] = value;
  }
  return params;
}

export async function fetchAuditLogs(f: AuditFilters): Promise<Paginated<AuditEntry>> {
  const params: Record<string, string | number> = auditParams(f);
  if (f.page && f.page > 1) params.page = f.page;
  return (await apiClient.get<Paginated<AuditEntry>>("/admin/audit-logs/", { params })).data;
}

export async function fetchAuditEventTypes(): Promise<string[]> {
  return (await apiClient.get<string[]>("/admin/audit-logs/event-types/")).data;
}

/** Plain download link (session cookie); the export is itself audited (AUD-04). */
export function auditExportUrl(fileType: "csv" | "xlsx", f: AuditFilters): string {
  const params = new URLSearchParams({ file_type: fileType, ...auditParams(f) });
  return `/api/v1/admin/audit-logs/export/?${params.toString()}`;
}
