import { apiClient } from "@/lib/apiClient";

import type { AdminDashboard } from "./types";

export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  const { data } = await apiClient.get<AdminDashboard>("/admin/reports/dashboard/");
  return data;
}
