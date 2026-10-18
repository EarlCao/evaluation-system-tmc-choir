import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Pagination from "@mui/material/Pagination";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useSearchParams } from "react-router";

import { ErrorState } from "@/components/ErrorState";
import { pageCount } from "@/lib/pagination";

import { NotificationList } from "../components/NotificationList";
import { useMarkAllRead, useNotifications } from "../queries";

/** Notification center (RT-01..04): every notification, newest first. */
export function NotificationsPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const unreadOnly = params.get("unread") === "true";
  const list = useNotifications(page, unreadOnly);
  const markAll = useMarkAllRead();

  return (
    <Stack spacing={3} sx={{ py: 4, maxWidth: 760 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", gap: 2 }}
      >
        <Typography variant="h4" component="h1">
          Notifications
        </Typography>
        <Button
          variant="outlined"
          disabled={markAll.isPending}
          onClick={() => {
            markAll.mutate();
          }}
        >
          Mark all as read
        </Button>
      </Stack>
      <FormControlLabel
        control={
          <Switch
            checked={unreadOnly}
            onChange={(e) => {
              setParams(e.target.checked ? { unread: "true" } : {}, { replace: true });
            }}
          />
        }
        label="Unread only"
      />
      {list.isError ? (
        <ErrorState
          message="We couldn't load your notifications."
          onRetry={() => void list.refetch()}
        />
      ) : list.isPending ? (
        <Skeleton variant="rounded" height={200} />
      ) : list.data.results.length === 0 ? (
        <Typography color="text.secondary">
          {unreadOnly ? "You're all caught up." : "No notifications yet."}
        </Typography>
      ) : (
        <>
          <Paper variant="outlined" sx={{ opacity: list.isPlaceholderData ? 0.6 : 1 }}>
            <NotificationList items={list.data.results} label="All notifications" />
          </Paper>
          {pageCount(list.data.count) > 1 ? (
            <Pagination
              count={pageCount(list.data.count)}
              page={page}
              onChange={(_, value) => {
                const next = new URLSearchParams(params);
                if (value > 1) next.set("page", String(value));
                else next.delete("page");
                setParams(next, { replace: true });
              }}
              sx={{ alignSelf: "center" }}
            />
          ) : null}
        </>
      )}
    </Stack>
  );
}
