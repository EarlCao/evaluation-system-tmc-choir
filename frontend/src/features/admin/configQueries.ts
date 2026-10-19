import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "./configApi";
import { adminKeys } from "./queries";

export const configKeys = {
  all: [...adminKeys.all, "config"] as const,
  categories: () => [...configKeys.all, "categories"] as const,
  criteria: (archived: boolean) => [...configKeys.all, "criteria", archived] as const,
  versions: (id: string) => [...configKeys.all, "versions", id] as const,
  commentPrompts: (archived: boolean) => [...configKeys.all, "commentPrompts", archived] as const,
  forms: () => [...configKeys.all, "forms"] as const,
  form: (id: string) => [...configKeys.all, "form", id] as const,
  cycles: () => [...configKeys.all, "cycles"] as const,
  cycle: (id: string) => [...configKeys.all, "cycle", id] as const,
};

/** Any configuration change refreshes all configuration views and the dashboard. */
function useConfigMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: configKeys.all });
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
  });
}

export const useCategories = () =>
  useQuery({ queryKey: configKeys.categories(), queryFn: api.fetchCategories });
export const useCriteria = (archived = false) =>
  useQuery({ queryKey: configKeys.criteria(archived), queryFn: () => api.fetchCriteria(archived) });
export const useCriterionVersions = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: configKeys.versions(id),
    queryFn: () => api.fetchCriterionVersions(id),
    enabled,
  });
export const useCommentPrompts = (archived = false) =>
  useQuery({
    queryKey: configKeys.commentPrompts(archived),
    queryFn: () => api.fetchCommentPrompts(archived),
  });
export const useForms = () => useQuery({ queryKey: configKeys.forms(), queryFn: api.fetchForms });
export const useForm = (id: string) =>
  useQuery({
    queryKey: configKeys.form(id),
    queryFn: () => api.fetchForm(id),
    enabled: Boolean(id),
  });
export const useCycles = () =>
  useQuery({ queryKey: configKeys.cycles(), queryFn: api.fetchCycles });
export const useCycle = (id: string) =>
  useQuery({
    queryKey: configKeys.cycle(id),
    queryFn: () => api.fetchCycle(id),
    enabled: Boolean(id),
  });

export const useCreateCategory = () => useConfigMutation(api.createCategory);
export const useDeleteCategory = () => useConfigMutation(api.deleteCategory);
export const useCreateCriterion = () => useConfigMutation(api.createCriterion);
export const useUpdateCriterion = () =>
  useConfigMutation((a: { id: string; changes: Parameters<typeof api.updateCriterion>[1] }) =>
    api.updateCriterion(a.id, a.changes),
  );
export const useArchiveCriterion = () => useConfigMutation(api.archiveCriterion);
export const useDeleteCriterion = () => useConfigMutation(api.deleteCriterion);
export const useReorderCriteria = () => useConfigMutation(api.reorderCriteria);
export const useCreateCommentPrompt = () => useConfigMutation(api.createCommentPrompt);
export const useUpdateCommentPrompt = () =>
  useConfigMutation((a: { id: string; changes: Parameters<typeof api.updateCommentPrompt>[1] }) =>
    api.updateCommentPrompt(a.id, a.changes),
  );
export const useArchiveCommentPrompt = () => useConfigMutation(api.archiveCommentPrompt);
export const useDeleteCommentPrompt = () => useConfigMutation(api.deleteCommentPrompt);
export const useReorderCommentPrompts = () => useConfigMutation(api.reorderCommentPrompts);
export const useCreateForm = () => useConfigMutation(api.createForm);
export const useUpdateForm = () =>
  useConfigMutation((a: { id: string; input: Parameters<typeof api.updateForm>[1] }) =>
    api.updateForm(a.id, a.input),
  );
export const usePublishForm = () => useConfigMutation(api.publishForm);
export const useCreateCycle = () => useConfigMutation(api.createCycle);
export const useUpdateCycle = () =>
  useConfigMutation((a: { id: string; input: Parameters<typeof api.updateCycle>[1] }) =>
    api.updateCycle(a.id, a.input),
  );
export const useTransitionCycle = () =>
  useConfigMutation((a: { id: string; action: "open" | "close" | "archive" }) =>
    api.transitionCycle(a.id, a.action),
  );
