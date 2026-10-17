import { keepPreviousData, useQuery } from "@tanstack/react-query";

import * as api from "./api";
import type { ReportFilters } from "./types";

export const reportKeys = {
  all: ["admin", "reports"] as const,
  choir: (f: ReportFilters) => [...reportKeys.all, "choir", f] as const,
  member: (id: string, f: ReportFilters) => [...reportKeys.all, "member", id, f] as const,
  participation: (cycle: string) => [...reportKeys.all, "participation", cycle] as const,
};

export const useChoirSummary = (filters: ReportFilters) =>
  useQuery({
    queryKey: reportKeys.choir(filters),
    queryFn: () => api.fetchChoirSummary(filters),
    placeholderData: keepPreviousData,
  });

export const useMemberSummary = (id: string, filters: ReportFilters) =>
  useQuery({
    queryKey: reportKeys.member(id, filters),
    queryFn: () => api.fetchMemberSummary(id, filters),
    placeholderData: keepPreviousData,
  });

export const useParticipation = (cycle: string) =>
  useQuery({
    queryKey: reportKeys.participation(cycle),
    queryFn: () => api.fetchParticipation(cycle),
    enabled: Boolean(cycle),
    placeholderData: keepPreviousData,
  });
