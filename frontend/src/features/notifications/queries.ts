import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "./api";

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (page: number, unreadOnly: boolean) =>
    [...notificationKeys.all, "list", page, unreadOnly] as const,
  unread: () => [...notificationKeys.all, "unread"] as const,
};

/** RT-05: poll every 30 s while the WebSocket is not open; otherwise pushes keep it fresh. */
export const POLL_MS = 30_000;

export const useUnreadCount = (poll: boolean) =>
  useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: api.fetchUnreadCount,
    refetchInterval: poll ? POLL_MS : false,
  });

export const useNotifications = (page: number, unreadOnly = false, enabled = true) =>
  useQuery({
    queryKey: notificationKeys.list(page, unreadOnly),
    queryFn: () => api.fetchNotifications(page, unreadOnly),
    placeholderData: keepPreviousData,
    enabled,
  });

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.markRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.markAllRead,
    onSuccess: () => {
      queryClient.setQueryData(notificationKeys.unread(), { unread: 0 });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
