import { apiClient } from "@/lib/apiClient";
import type { Paginated } from "@/lib/pagination";

import type { FeedbackFilters, FeedbackItem, FeedbackSummary } from "./types";

export async function fetchReceived(filters: FeedbackFilters): Promise<Paginated<FeedbackItem>> {
  const { data } = await apiClient.get<Paginated<FeedbackItem>>("/feedback/received/", {
    params: {
      cycle: filters.cycle || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      page: filters.page && filters.page > 1 ? filters.page : undefined,
    },
  });
  return data;
}

export async function fetchSummary(cycle?: string): Promise<FeedbackSummary> {
  const { data } = await apiClient.get<FeedbackSummary>("/feedback/received/summary/", {
    params: { cycle: cycle || undefined },
  });
  return data;
}
