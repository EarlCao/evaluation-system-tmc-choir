import { apiClient } from "@/lib/apiClient";

import type { ChoirSummary, MemberSummary, ParticipationReport, ReportFilters } from "./types";

function clean(params: object): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value) out[key] = value;
  }
  return out;
}

export async function fetchChoirSummary(f: ReportFilters): Promise<ChoirSummary> {
  return (await apiClient.get<ChoirSummary>("/admin/reports/choir/", { params: clean(f) })).data;
}

export async function fetchMemberSummary(id: string, f: ReportFilters): Promise<MemberSummary> {
  const { data } = await apiClient.get<MemberSummary>(
    `/admin/reports/members/${encodeURIComponent(id)}/`,
    { params: clean(f) },
  );
  return data;
}

export async function fetchParticipation(cycle: string): Promise<ParticipationReport> {
  const { data } = await apiClient.get<ParticipationReport>("/admin/reports/participation/", {
    params: { cycle },
  });
  return data;
}
