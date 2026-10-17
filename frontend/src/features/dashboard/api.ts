import { apiClient } from "@/lib/apiClient";

/** GET /api/v1/dashboard/ (grows with later steps: cycles, feedback). */
export interface MemberDashboard {
  active_members: number;
  voice_section: string | null;
}

export async function fetchDashboard(): Promise<MemberDashboard> {
  const { data } = await apiClient.get<MemberDashboard>("/dashboard/");
  return data;
}
