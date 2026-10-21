import { apiClient, apiUrl } from "@/lib/apiClient";
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

export async function deleteAuditLog(id: number): Promise<void> {
  await apiClient.delete(`/admin/audit-logs/${String(id)}/`);
}

export async function clearAuditLogs(f?: AuditFilters): Promise<{ deleted: number }> {
  const params = f ? auditParams(f) : undefined;
  return (await apiClient.delete<{ deleted: number }>("/admin/audit-logs/", { params })).data;
}

/** Plain download link (session cookie); the export is itself audited (AUD-04). */
export function auditExportUrl(fileType: "csv" | "xlsx", f: AuditFilters): string {
  const params = new URLSearchParams({ file_type: fileType, ...auditParams(f) });
  return apiUrl(`/admin/audit-logs/export/?${params.toString()}`);
}

export async function fetchBackups(): Promise<import("./systemTypes").BackupItem[]> {
  return (await apiClient.get<import("./systemTypes").BackupItem[]>("/admin/backups/")).data;
}

export async function createBackup(
  input?: import("./systemTypes").BackupCreateInput,
): Promise<import("./systemTypes").BackupItem> {
  return (await apiClient.post<import("./systemTypes").BackupItem>("/admin/backups/", input ?? {}))
    .data;
}

export async function deleteBackup(filename: string): Promise<void> {
  await apiClient.delete(`/admin/backups/${encodeURIComponent(filename)}/`);
}

export function backupDownloadUrl(filename: string): string {
  return apiUrl(`/admin/backups/${encodeURIComponent(filename)}/download/`);
}

export async function restoreBackup(params: {
  filename?: string;
  file?: File;
}): Promise<import("./systemTypes").RestoreResult> {
  if (params.file) {
    const formData = new FormData();
    formData.append("file", params.file);
    return (
      await apiClient.post<import("./systemTypes").RestoreResult>(
        "/admin/backups/restore/",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      )
    ).data;
  }
  return (
    await apiClient.post<import("./systemTypes").RestoreResult>("/admin/backups/restore/", {
      filename: params.filename,
    })
  ).data;
}

export async function runRetentionCleanup(): Promise<
  import("./systemTypes").RetentionCleanupResult
> {
  return (
    await apiClient.post<import("./systemTypes").RetentionCleanupResult>(
      "/admin/data-management/cleanup/",
      {},
    )
  ).data;
}
