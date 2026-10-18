import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { connectSocket, type SocketStatus } from "@/lib/ws";

import { adminKeys } from "./queries";

const POLL_MS = 60_000;

/**
 * RT-01 / RT-04: live admin counts. "/ws/admin/" only says *that* something changed; the
 * dashboard, member and moderation lists refetch over REST. Polls while disconnected (RT-05).
 */
export function useAdminLiveUpdates(): SocketStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SocketStatus>("connecting");

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, "members"] });
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, "evaluations"] });
    };
    return connectSocket("/ws/admin/", {
      onMessage: (message) => {
        if (message.type === "dashboard.changed") refresh();
      },
      onStatus: setStatus,
      onReconnect: refresh,
    });
  }, [queryClient]);

  useEffect(() => {
    if (status === "open") return;
    const timer = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    }, POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [status, queryClient]);

  return status;
}
