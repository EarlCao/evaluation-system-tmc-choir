import { apiClient } from "@/lib/apiClient";
import type { Paginated } from "@/lib/pagination";

import type {
  AdminEvaluation,
  AdminEvaluationDetail,
  AdminEvaluationFilters,
  AdminRevision,
  ModerationActionKind,
  ModerationTarget,
} from "./moderationTypes";

const evaluation = (id: string) => `/admin/evaluations/${encodeURIComponent(id)}/`;

export async function fetchAdminEvaluations(
  f: AdminEvaluationFilters,
): Promise<Paginated<AdminEvaluation>> {
  const { page, ...rest } = f;
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(rest)) if (value) params[key] = value;
  if (page && page > 1) params.page = page;
  return (await apiClient.get<Paginated<AdminEvaluation>>("/admin/evaluations/", { params })).data;
}

export async function fetchModerationQueue(page = 1): Promise<Paginated<AdminEvaluation>> {
  const params = page > 1 ? { page } : {};
  return (await apiClient.get<Paginated<AdminEvaluation>>("/admin/moderation-queue/", { params }))
    .data;
}

export async function fetchAdminEvaluation(id: string): Promise<AdminEvaluationDetail> {
  return (await apiClient.get<AdminEvaluationDetail>(evaluation(id))).data;
}

export async function fetchAdminRevisions(id: string): Promise<AdminRevision[]> {
  return (await apiClient.get<AdminRevision[]>(`${evaluation(id)}revisions/`)).data;
}

export async function moderateEvaluation(
  id: string,
  body: { action: ModerationActionKind; target: ModerationTarget; reason: string },
): Promise<AdminEvaluationDetail> {
  return (await apiClient.post<AdminEvaluationDetail>(`${evaluation(id)}moderate/`, body)).data;
}
