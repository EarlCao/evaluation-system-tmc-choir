import { apiClient } from "@/lib/apiClient";
import type { Paginated } from "@/lib/pagination";

import type {
  CycleForm,
  CycleSummary,
  EditPayload,
  Eligibility,
  MyEvaluation,
  Revision,
  SubmitPayload,
} from "./types";

export async function fetchCurrentCycle(): Promise<CycleSummary | null> {
  const { data } = await apiClient.get<{ cycle: CycleSummary | null }>(
    "/evaluation-cycles/current/",
  );
  return data.cycle;
}

export async function fetchCycleForm(cyclePublicId: string): Promise<CycleForm> {
  const { data } = await apiClient.get<CycleForm>(
    `/evaluation-cycles/${encodeURIComponent(cyclePublicId)}/form/`,
  );
  return data;
}

export async function fetchEligibility(recipient: string): Promise<Eligibility> {
  const { data } = await apiClient.get<Eligibility>("/evaluations/eligibility/", {
    params: { recipient },
  });
  return data;
}

export async function submitEvaluation(payload: SubmitPayload): Promise<MyEvaluation> {
  const { data } = await apiClient.post<MyEvaluation>("/evaluations/", payload);
  return data;
}

export async function fetchMyEvaluations(page: number): Promise<Paginated<MyEvaluation>> {
  const { data } = await apiClient.get<Paginated<MyEvaluation>>("/evaluations/mine/", {
    params: { page: page > 1 ? page : undefined },
  });
  return data;
}

export async function fetchMyEvaluation(publicId: string): Promise<MyEvaluation> {
  const { data } = await apiClient.get<MyEvaluation>(
    `/evaluations/mine/${encodeURIComponent(publicId)}/`,
  );
  return data;
}

export async function editEvaluation(
  publicId: string,
  payload: EditPayload,
): Promise<MyEvaluation> {
  const { data } = await apiClient.patch<MyEvaluation>(
    `/evaluations/mine/${encodeURIComponent(publicId)}/`,
    payload,
  );
  return data;
}

export async function fetchRevisions(publicId: string): Promise<Revision[]> {
  const { data } = await apiClient.get<Revision[]>(
    `/evaluations/mine/${encodeURIComponent(publicId)}/revisions/`,
  );
  return data;
}
