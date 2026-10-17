import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "./moderationApi";
import type { AdminEvaluationFilters } from "./moderationTypes";
import { adminKeys } from "./queries";

export const moderationKeys = {
  all: [...adminKeys.all, "evaluations"] as const,
  list: (f: AdminEvaluationFilters) => [...moderationKeys.all, "list", f] as const,
  queue: (page: number) => [...moderationKeys.all, "queue", page] as const,
  detail: (id: string) => [...moderationKeys.all, "detail", id] as const,
  revisions: (id: string) => [...moderationKeys.all, "revisions", id] as const,
};

export const useAdminEvaluations = (filters: AdminEvaluationFilters) =>
  useQuery({
    queryKey: moderationKeys.list(filters),
    queryFn: () => api.fetchAdminEvaluations(filters),
    placeholderData: keepPreviousData,
  });

export const useModerationQueue = (page: number) =>
  useQuery({
    queryKey: moderationKeys.queue(page),
    queryFn: () => api.fetchModerationQueue(page),
    placeholderData: keepPreviousData,
  });

export const useAdminEvaluation = (id: string) =>
  useQuery({ queryKey: moderationKeys.detail(id), queryFn: () => api.fetchAdminEvaluation(id) });

export const useAdminRevisions = (id: string) =>
  useQuery({
    queryKey: moderationKeys.revisions(id),
    queryFn: () => api.fetchAdminRevisions(id),
  });

export function useModerate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof api.moderateEvaluation>[1]) =>
      api.moderateEvaluation(id, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(moderationKeys.detail(id), updated);
      void queryClient.invalidateQueries({ queryKey: [...moderationKeys.all, "list"] });
      void queryClient.invalidateQueries({ queryKey: [...moderationKeys.all, "queue"] });
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
  });
}
