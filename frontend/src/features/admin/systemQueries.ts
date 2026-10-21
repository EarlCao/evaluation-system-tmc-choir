import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminKeys } from "./queries";
import * as api from "./systemApi";
import type { AuditFilters } from "./systemTypes";

export const systemKeys = {
  settings: () => [...adminKeys.all, "settings"] as const,
  audit: (f: AuditFilters) => [...adminKeys.all, "audit", f] as const,
  eventTypes: () => [...adminKeys.all, "audit-event-types"] as const,
  backups: () => [...adminKeys.all, "backups"] as const,
};

export const useAdminSettings = () =>
  useQuery({ queryKey: systemKeys.settings(), queryFn: api.fetchAdminSettings });

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.updateAdminSettings,
    onSuccess: (saved) => {
      queryClient.setQueryData(systemKeys.settings(), saved);
      // Public settings (privacy notice, system name) are shown everywhere.
      void queryClient.invalidateQueries({ queryKey: ["system", "public"] });
    },
  });
}

export const useAuditLogs = (filters: AuditFilters) =>
  useQuery({
    queryKey: systemKeys.audit(filters),
    queryFn: () => api.fetchAuditLogs(filters),
    placeholderData: keepPreviousData,
  });

export const useAuditEventTypes = () =>
  useQuery({ queryKey: systemKeys.eventTypes(), queryFn: api.fetchAuditEventTypes });

export function useDeleteAuditLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteAuditLog,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, "audit"] });
      void queryClient.invalidateQueries({ queryKey: systemKeys.eventTypes() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
  });
}

export function useClearAuditLogs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.clearAuditLogs,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, "audit"] });
      void queryClient.invalidateQueries({ queryKey: systemKeys.eventTypes() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
  });
}

export const useBackups = () =>
  useQuery({
    queryKey: systemKeys.backups(),
    queryFn: api.fetchBackups,
  });

export function useCreateBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createBackup,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: systemKeys.backups() });
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, "audit"] });
    },
  });
}

export function useDeleteBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteBackup,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: systemKeys.backups() });
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, "audit"] });
    },
  });
}

export function useRestoreBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.restoreBackup,
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}

export function useRunRetentionCleanup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.runRetentionCleanup,
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}
