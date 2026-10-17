import Pagination from "@mui/material/Pagination";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useSearchParams } from "react-router";

import { ErrorState } from "@/components/ErrorState";
import { pageCount } from "@/lib/pagination";

import { EvaluationsTable, IdentityAccessNotice } from "../components/EvaluationsTable";
import { useModerationQueue } from "../moderationQueries";

/** ADM-05: everything flagged (an evaluation or one of its texts), oldest first. */
export function AdminModerationPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const queue = useModerationQueue(page);
  return (
    <Stack spacing={3} sx={{ py: 4 }}>
      <Typography variant="h4" component="h1">
        Moderation queue
      </Typography>
      <Typography color="text.secondary">
        Flagged content stays visible to the member until you hide it. Hiding never deletes
        anything, and every decision is kept with its reason.
      </Typography>
      <IdentityAccessNotice />
      {queue.isError ? (
        <ErrorState message="We couldn't load the queue." onRetry={() => void queue.refetch()} />
      ) : queue.isPending ? (
        <Skeleton variant="rounded" height={200} />
      ) : queue.data.results.length === 0 ? (
        <Typography color="text.secondary">Nothing is waiting for review.</Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" role="status">
            {queue.data.count} waiting for review
          </Typography>
          <EvaluationsTable
            rows={queue.data.results}
            label="Moderation queue"
            dimmed={queue.isPlaceholderData}
          />
          {pageCount(queue.data.count) > 1 ? (
            <Pagination
              count={pageCount(queue.data.count)}
              page={page}
              onChange={(_, value) => {
                setParams(value > 1 ? { page: String(value) } : {}, { replace: true });
              }}
              sx={{ alignSelf: "center" }}
            />
          ) : null}
        </>
      )}
    </Stack>
  );
}
