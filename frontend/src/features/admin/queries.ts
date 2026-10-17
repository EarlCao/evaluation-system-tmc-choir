import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "./api";
import type { AdminMember, AdminMemberFilters } from "./types";

export const adminKeys = {
  all: ["admin"] as const,
  dashboard: () => [...adminKeys.all, "dashboard"] as const,
  members: (f: AdminMemberFilters) => [...adminKeys.all, "members", f] as const,
  member: (id: string) => [...adminKeys.all, "member", id] as const,
  voiceSections: () => [...adminKeys.all, "voice-sections"] as const,
};

export function useAdminDashboard() {
  return useQuery({ queryKey: adminKeys.dashboard(), queryFn: api.fetchAdminDashboard });
}

export function useAdminMembers(filters: AdminMemberFilters) {
  return useQuery({
    queryKey: adminKeys.members(filters),
    queryFn: () => api.fetchAdminMembers(filters),
    placeholderData: keepPreviousData,
  });
}

export function useAdminMember(id: string) {
  return useQuery({ queryKey: adminKeys.member(id), queryFn: () => api.fetchAdminMember(id) });
}

/** Wraps a member action: on success the detail is replaced and lists/dashboard refetch. */
export function useMemberAction<TArgs>(id: string, action: (args: TArgs) => Promise<AdminMember>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: (updated) => {
      queryClient.setQueryData(adminKeys.member(id), updated);
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, "members"] });
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
  });
}

export function useSendPasswordReset(id: string) {
  return useMutation({ mutationFn: () => api.sendMemberPasswordReset(id) });
}

export function useAdminVoiceSections() {
  return useQuery({ queryKey: adminKeys.voiceSections(), queryFn: api.fetchAdminVoiceSections });
}

export function useVoiceSectionMutations() {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: adminKeys.voiceSections() });
    void queryClient.invalidateQueries({ queryKey: ["auth", "voice-sections"] });
  };
  return {
    create: useMutation({ mutationFn: api.createVoiceSection, onSuccess: refresh }),
    update: useMutation({
      mutationFn: (args: { id: number; changes: Parameters<typeof api.updateVoiceSection>[1] }) =>
        api.updateVoiceSection(args.id, args.changes),
      onSuccess: refresh,
    }),
  };
}
