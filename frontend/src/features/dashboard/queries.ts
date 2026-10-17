import { useQuery } from "@tanstack/react-query";

import { fetchDashboard } from "./api";

export const dashboardKeys = { member: ["dashboard", "member"] as const };

export function useMemberDashboard() {
  return useQuery({ queryKey: dashboardKeys.member, queryFn: fetchDashboard });
}
