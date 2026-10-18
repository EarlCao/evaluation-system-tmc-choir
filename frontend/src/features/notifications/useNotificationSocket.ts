import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { authKeys } from "@/features/auth";
import { dashboardKeys } from "@/features/dashboard";
import { evaluationKeys } from "@/features/evaluations";
import { feedbackKeys } from "@/features/feedback";
import { connectSocket, type SocketMessage, type SocketStatus } from "@/lib/ws";

import { notificationKeys } from "./queries";
import type { AppNotification, UnreadCount } from "./types";

interface CreatedPayload {
  notification: AppNotification;
  unread: number;
}

function refreshFor(queryClient: QueryClient, type: AppNotification["type"]) {
  if (type === "FEEDBACK_AVAILABLE") {
    void queryClient.invalidateQueries({ queryKey: feedbackKeys.all });
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.member });
  }
  if (type === "CYCLE_OPENED" || type === "CYCLE_CLOSED") {
    void queryClient.invalidateQueries({ queryKey: evaluationKeys.all });
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.member });
  }
}

/**
 * Live notifications over /ws/notifications/ (RT-01..03). Returns the socket status so the
 * unread count can fall back to polling while it is not open (RT-05).
 */
export function useNotificationSocket(): SocketStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SocketStatus>("connecting");

  useEffect(() => {
    const onMessage = (message: SocketMessage) => {
      if (message.type === "unread_count") {
        queryClient.setQueryData<UnreadCount>(
          notificationKeys.unread(),
          message.payload as UnreadCount,
        );
      } else if (message.type === "notification.created") {
        const payload = message.payload as CreatedPayload;
        queryClient.setQueryData<UnreadCount>(notificationKeys.unread(), {
          unread: payload.unread,
        });
        void queryClient.invalidateQueries({ queryKey: [...notificationKeys.all, "list"] });
        refreshFor(queryClient, payload.notification.type);
      }
    };
    return connectSocket("/ws/notifications/", {
      onMessage,
      onStatus: setStatus,
      // Reconnected: anything pushed meanwhile was missed, so resync over REST.
      onReconnect: () => {
        void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
        void queryClient.invalidateQueries({ queryKey: feedbackKeys.all });
        void queryClient.invalidateQueries({ queryKey: dashboardKeys.member });
      },
      // Signed out or suspended: re-check the session; the route guards take it from there.
      onFatal: () => void queryClient.invalidateQueries({ queryKey: authKeys.currentUser() }),
    });
  }, [queryClient]);

  return status;
}
