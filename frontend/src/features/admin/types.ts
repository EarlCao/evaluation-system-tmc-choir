export interface AdminOpenCycle {
  public_id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  evaluation_scope: "ALL" | "SAME_SECTION";
  evaluations_submitted: number;
  possible_pairs: number;
  submitted_pairs: number;
  participating_members: number;
  participation_percent: number | null;
}

/** GET /api/v1/admin/reports/dashboard/ (ADM-01). */
export interface AdminDashboard {
  members: {
    registered: number;
    active: number;
    pending: number;
    suspended: number;
    deactivated: number;
  };
  evaluations_submitted: number;
  needs_moderation: number;
  cycles: { DRAFT: number; OPEN: number; CLOSED: number; ARCHIVED: number };
  open_cycle: AdminOpenCycle | null;
}

export type UserRole = "MEMBER" | "SUPER_ADMIN";
export type UserStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";

export interface AdminVoiceSection {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
  member_count: number | null;
}

/** GET /api/v1/admin/members/ entry (admin view: contact details and account state). */
export interface AdminMember {
  public_id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  role: UserRole;
  status: UserStatus;
  email_verified: boolean;
  date_joined: string;
  last_login: string | null;
  approved_at: string | null;
  profile: {
    voice_section: AdminVoiceSection;
    is_evaluable: boolean;
    is_officer?: boolean;
    officer_position?: string;
    joined_choir_on: string | null;
    bio: string;
  } | null;
}

export interface AdminMemberFilters {
  search?: string;
  status?: UserStatus | "";
  role?: UserRole | "";
  page?: number;
}

export const STATUS_LABEL: Record<UserStatus, string> = {
  PENDING: "Waiting for approval",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  DEACTIVATED: "Deactivated",
};
