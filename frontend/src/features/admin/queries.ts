import { useQuery } from "@tanstack/react-query";

import * as api from "./api";

export const adminKeys = {
  all: ["admin"] as const,
  dashboard: () => [...adminKeys.all, "dashboard"] as const,
};

export function useAdminDashboard() {
  return useQuery({ queryKey: adminKeys.dashboard(), queryFn: api.fetchAdminDashboard });
}
