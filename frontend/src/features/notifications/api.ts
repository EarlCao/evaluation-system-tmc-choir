import { apiClient } from "@/lib/apiClient";
import type { Paginated } from "@/lib/pagination";

import type { AppNotification, UnreadCount } from "./types";

export async function fetchNotifications(
  page: number,
  unreadOnly: boolean,
): Promise<Paginated<AppNotification>> {
  const params: Record<string, string | number> = {};
  if (page > 1) params.page = page;
  if (unreadOnly) params.unread = "true";
  return (await apiClient.get<Paginated<AppNotification>>("/notifications/", { params })).data;
}

export async function fetchUnreadCount(): Promise<UnreadCount> {
  return (await apiClient.get<UnreadCount>("/notifications/unread-count/")).data;
}

export async function markRead(publicId: string): Promise<AppNotification> {
  const url = `/notifications/${encodeURIComponent(publicId)}/read/`;
  return (await apiClient.post<AppNotification>(url)).data;
}

export async function markAllRead(): Promise<{ marked: number }> {
  return (await apiClient.post<{ marked: number }>("/notifications/read-all/")).data;
}
