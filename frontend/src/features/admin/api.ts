import { apiClient } from "@/lib/apiClient";

import type { Paginated } from "@/lib/pagination";

import type {
  AdminDashboard,
  AdminMember,
  AdminMemberFilters,
  AdminVoiceSection,
  UserRole,
  UserStatus,
} from "./types";

export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  const { data } = await apiClient.get<AdminDashboard>("/admin/reports/dashboard/");
  return data;
}

const member = (id: string) => `/admin/members/${encodeURIComponent(id)}/`;

export async function fetchAdminMembers(f: AdminMemberFilters): Promise<Paginated<AdminMember>> {
  const { data } = await apiClient.get<Paginated<AdminMember>>("/admin/members/", {
    params: {
      search: f.search || undefined,
      status: f.status || undefined,
      role: f.role || undefined,
      page: f.page && f.page > 1 ? f.page : undefined,
    },
  });
  return data;
}

export async function fetchAdminMember(id: string): Promise<AdminMember> {
  return (await apiClient.get<AdminMember>(member(id))).data;
}

export async function updateAdminProfile(
  id: string,
  changes: {
    voice_section?: number;
    is_evaluable?: boolean;
    is_officer?: boolean;
    officer_position?: string;
    joined_choir_on?: string | null;
  },
): Promise<AdminMember> {
  return (await apiClient.patch<AdminMember>(member(id), changes)).data;
}

export async function approveMember(id: string): Promise<AdminMember> {
  return (await apiClient.post<AdminMember>(`${member(id)}approve/`)).data;
}

export async function setMemberStatus(
  id: string,
  status: UserStatus,
  reason: string,
): Promise<AdminMember> {
  return (await apiClient.post<AdminMember>(`${member(id)}status/`, { status, reason })).data;
}

export async function setMemberRole(id: string, role: UserRole): Promise<AdminMember> {
  return (await apiClient.post<AdminMember>(`${member(id)}role/`, { role })).data;
}

export async function sendMemberPasswordReset(id: string): Promise<void> {
  await apiClient.post(`${member(id)}send-password-reset/`);
}

export async function fetchAdminVoiceSections(): Promise<AdminVoiceSection[]> {
  return (await apiClient.get<AdminVoiceSection[]>("/admin/voice-sections/")).data;
}

export async function createVoiceSection(name: string): Promise<AdminVoiceSection> {
  return (await apiClient.post<AdminVoiceSection>("/admin/voice-sections/", { name })).data;
}

export async function updateVoiceSection(
  id: number,
  changes: Partial<Pick<AdminVoiceSection, "name" | "sort_order" | "is_active">>,
): Promise<AdminVoiceSection> {
  return (await apiClient.patch<AdminVoiceSection>(`/admin/voice-sections/${String(id)}/`, changes))
    .data;
}
