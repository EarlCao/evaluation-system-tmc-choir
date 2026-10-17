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
  cycles: { DRAFT: number; OPEN: number; CLOSED: number; ARCHIVED: number };
  open_cycle: AdminOpenCycle | null;
}
