import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { Link as RouterLink } from "react-router";

import { useMarkAllRead, useNotifications, useUnreadCount } from "../queries";
import { useNotificationSocket } from "../useNotificationSocket";
import { NotificationList } from "./NotificationList";

function BellIcon() {
  return (
    <SvgIcon>
      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2m6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1z" />
    </SvgIcon>
  );
}

/** Header bell (RT-01..03): live unread badge, latest notifications, polling fallback (RT-05). */
export function NotificationBell({ base }: { base: "/app" | "/admin" }) {
  const status = useNotificationSocket();
  const unread = useUnreadCount(status !== "open");
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const latest = useNotifications(1, false, anchor !== null);
  const markAll = useMarkAllRead();
  const count = unread.data?.unread ?? 0;
  const close = () => {
    setAnchor(null);
  };

  return (
    <>
      <IconButton
        color="inherit"
        aria-label={count ? `Notifications, ${String(count)} unread` : "Notifications"}
        aria-haspopup="dialog"
        onClick={(e) => {
          setAnchor(e.currentTarget);
        }}
      >
        <Badge badgeContent={count} color="primary" max={99}>
          <BellIcon />
        </Badge>
      </IconButton>
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 360, maxWidth: "calc(100vw - 32px)" } } }}
      >
        <Stack role="dialog" aria-label="Notifications">
          <Stack
            direction="row"
            sx={{ p: 2, alignItems: "center", justifyContent: "space-between" }}
          >
            <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
              Notifications
            </Typography>
            <Button
              size="small"
              disabled={count === 0 || markAll.isPending}
              onClick={() => {
                markAll.mutate();
              }}
            >
              Mark all as read
            </Button>
          </Stack>
          <Divider />
          {latest.isPending ? (
            <Typography sx={{ p: 2 }} color="text.secondary">
              Loading…
            </Typography>
          ) : latest.isError ? (
            <Typography sx={{ p: 2 }} color="error">
              We couldn't load your notifications.
            </Typography>
          ) : latest.data.results.length === 0 ? (
            <Typography sx={{ p: 2 }} color="text.secondary">
              Nothing new.
            </Typography>
          ) : (
            <NotificationList items={latest.data.results.slice(0, 5)} onOpen={close} />
          )}
          <Divider />
          <Button component={RouterLink} to={`${base}/notifications`} onClick={close} sx={{ m: 1 }}>
            See all notifications
          </Button>
          {status !== "open" ? (
            <Typography variant="caption" color="text.secondary" sx={{ px: 2, pb: 1 }}>
              Live updates are reconnecting; checking every 30 seconds.
            </Typography>
          ) : null}
        </Stack>
      </Popover>
    </>
  );
}
