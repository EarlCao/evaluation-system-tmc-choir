import { useQuery } from "@tanstack/react-query";

import { apiClient } from "./apiClient";

/** GET /api/v1/system/public/ (SET-03). */
export interface PublicSettings {
  system_name: string;
  choir_name: string;
  choir_description: string;
  privacy_notice: string;
  registration_mode: "OPEN" | "APPROVAL" | "EMAIL_VERIFICATION" | "CLOSED";
}

export async function fetchPublicSettings(): Promise<PublicSettings> {
  const { data } = await apiClient.get<PublicSettings>("/system/public/");
  return data;
}

export function usePublicSettings() {
  return useQuery({
    queryKey: ["system", "public"],
    queryFn: fetchPublicSettings,
    staleTime: 10 * 60_000,
  });
}
