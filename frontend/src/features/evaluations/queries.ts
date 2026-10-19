import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "./api";
import type { EditPayload } from "./types";

export const evaluationKeys = {
  all: ["evaluations"] as const,
  currentCycle: () => [...evaluationKeys.all, "current-cycle"] as const,
  cycleForm: (cycle: string) => [...evaluationKeys.all, "cycle-form", cycle] as const,
  eligibility: (recipient: string) => [...evaluationKeys.all, "eligibility", recipient] as const,
  mine: (page: number) => [...evaluationKeys.all, "mine", page] as const,
  mineDetail: (publicId: string) => [...evaluationKeys.all, "mine-detail", publicId] as const,
  revisions: (publicId: string) => [...evaluationKeys.all, "revisions", publicId] as const,
};

export function useCurrentCycle() {
  return useQuery({ queryKey: evaluationKeys.currentCycle(), queryFn: api.fetchCurrentCycle });
}

export function useCycleForm(cyclePublicId: string | undefined) {
  return useQuery({
    queryKey: evaluationKeys.cycleForm(cyclePublicId ?? ""),
    queryFn: () => api.fetchCycleForm(cyclePublicId ?? ""),
    enabled: Boolean(cyclePublicId),
    staleTime: 5 * 60_000,
  });
}

export function useEligibility(recipient: string) {
  return useQuery({
    queryKey: evaluationKeys.eligibility(recipient),
    queryFn: () => api.fetchEligibility(recipient),
  });
}

export function useSubmitEvaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.submitEvaluation,
    onSuccess: (evaluation) => {
      queryClient.setQueryData(evaluationKeys.mineDetail(evaluation.public_id), evaluation);
      void queryClient.invalidateQueries({ queryKey: evaluationKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

export function useMyEvaluations(page: number) {
  return useQuery({
    queryKey: evaluationKeys.mine(page),
    queryFn: () => api.fetchMyEvaluations(page),
    placeholderData: keepPreviousData,
  });
}

export function useMyEvaluation(publicId: string) {
  return useQuery({
    queryKey: evaluationKeys.mineDetail(publicId),
    queryFn: () => api.fetchMyEvaluation(publicId),
  });
}

export function useEditEvaluation(publicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EditPayload) => api.editEvaluation(publicId, payload),
    onSuccess: (evaluation) => {
      queryClient.setQueryData(evaluationKeys.mineDetail(publicId), evaluation);
      void queryClient.invalidateQueries({ queryKey: evaluationKeys.revisions(publicId) });
      void queryClient.invalidateQueries({ queryKey: [...evaluationKeys.all, "mine"] });
    },
  });
}

export function useRevisions(publicId: string) {
  return useQuery({
    queryKey: evaluationKeys.revisions(publicId),
    queryFn: () => api.fetchRevisions(publicId),
  });
}
