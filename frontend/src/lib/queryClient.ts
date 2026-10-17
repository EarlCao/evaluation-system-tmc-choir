import { QueryClient, type DefaultOptions } from "@tanstack/react-query";

import { isApiError } from "./errors";

const MAX_RETRIES = 2;

/** Retry network/5xx failures a couple of times; never retry 4xx (they won't change). */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
  return failureCount < MAX_RETRIES;
}

export function createQueryClient(overrides: DefaultOptions["queries"] = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 30_000, ...overrides },
      mutations: { retry: false },
    },
  });
}
