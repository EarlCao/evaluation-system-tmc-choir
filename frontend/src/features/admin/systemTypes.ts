export type RegistrationMode = "OPEN" | "APPROVAL" | "EMAIL_VERIFICATION" | "CLOSED";

/** GET/PATCH /api/v1/admin/settings/ (SET-01, SET-03). */
export interface AdminSettings {
  system_name: string;
  choir_name: string;
  choir_description: string;
  time_zone: string;
  registration_mode: RegistrationMode;
  min_aggregate_group_size: number;
  feedback_notification_debounce_minutes: number;
  privacy_notice: string;
  retention_evaluations_days: number | null;
  retention_revisions_days: number | null;
  retention_audit_days: number | null;
  updated_at: string;
  updated_by: string | null;
}

export type SettingsInput = Partial<Omit<AdminSettings, "updated_at" | "updated_by">>;

export const REGISTRATION_LABEL: Record<RegistrationMode, string> = {
  OPEN: "Open: accounts are active immediately",
  APPROVAL: "Super Admin approval required",
  EMAIL_VERIFICATION: "Email verification required",
  CLOSED: "Registration closed",
};

/** GET /api/v1/admin/audit-logs/ entry (AUD-02, AUD-04). */
export interface AuditEntry {
  id: number;
  occurred_at: string;
  event_type: string;
  actor: { public_id: string; name: string; username: string } | null;
  actor_role: string;
  target_type: string;
  target_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string;
  request_id: string;
}

export interface AuditFilters {
  search?: string;
  event_type?: string;
  actor?: string;
  occurred_from?: string;
  occurred_to?: string;
  page?: number;
}
