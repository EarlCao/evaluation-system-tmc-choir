import { apiClient } from "@/lib/apiClient";

/** GET /api/v1/dashboard/ (grows with later steps: cycles, feedback). */
export interface OpenCycleProgress {
  public_id: string;
  name: string;
  ends_at: string;
  evaluations_given: number;
  members_left: number;
}

export interface MemberDashboard {
  active_members: number;
  voice_section: string | null;
  open_cycle: OpenCycleProgress | null;
  feedback_received: number;
}

export async function fetchDashboard(): Promise<MemberDashboard> {
  const { data } = await apiClient.get<MemberDashboard>("/dashboard/");
  return data;
}
