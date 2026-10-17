import { useQuery } from "@tanstack/react-query";

import { apiClient } from "./apiClient";

export interface Health {
  status: "ok" | "error";
  db: "ok" | "error";
}

export async function fetchHealth(): Promise<Health> {
  const { data } = await apiClient.get<Health>("/health/");
  return data;
}

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    retry: false,
    refetchInterval: 60_000,
  });
}
