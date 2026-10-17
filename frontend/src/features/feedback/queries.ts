import { keepPreviousData, useQuery } from "@tanstack/react-query";

import * as api from "./api";
import type { FeedbackFilters } from "./types";

export const feedbackKeys = {
  all: ["feedback"] as const,
  received: (filters: FeedbackFilters) => [...feedbackKeys.all, "received", filters] as const,
  summary: (cycle: string) => [...feedbackKeys.all, "summary", cycle] as const,
};

export function useReceivedFeedback(filters: FeedbackFilters) {
  return useQuery({
    queryKey: feedbackKeys.received(filters),
    queryFn: () => api.fetchReceived(filters),
    placeholderData: keepPreviousData,
  });
}

export function useFeedbackSummary(cycle = "") {
  return useQuery({
    queryKey: feedbackKeys.summary(cycle),
    queryFn: () => api.fetchSummary(cycle),
    placeholderData: keepPreviousData,
  });
}
