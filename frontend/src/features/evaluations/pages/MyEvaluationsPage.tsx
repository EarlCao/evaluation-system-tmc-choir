import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Pagination from "@mui/material/Pagination";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Link as RouterLink, useSearchParams } from "react-router";

import { ErrorState } from "@/components/ErrorState";
import { pageCount } from "@/lib/pagination";

import { useMyEvaluations } from "../queries";
import { recipientName } from "../types";

/** MINE-01: evaluations the logged-in member wrote. */
export function MyEvaluationsPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const list = useMyEvaluations(page);

  return (
    <Stack spacing={3} sx={{ py: 4, maxWidth: 860 }}>
      <Typography variant="h4" component="h1">
        My submitted evaluations
      </Typography>
      {list.isError ? (
        <ErrorState
          message="We couldn't load your evaluations."
          onRetry={() => void list.refetch()}
        />
      ) : list.isPending ? (
        <Stack spacing={2} aria-busy="true" aria-label="Loading evaluations">
          <Skeleton variant="rounded" height={84} />
          <Skeleton variant="rounded" height={84} />
        </Stack>
      ) : list.data.results.length === 0 ? (
        <Typography color="text.secondary">
          You haven't submitted any evaluations yet. Open a member's profile to evaluate them.
        </Typography>
      ) : (
        <>
          <Stack
            component="ul"
            spacing={2}
            aria-label="Your evaluations"
            sx={{ listStyle: "none", p: 0, m: 0 }}
          >
            {list.data.results.map((ev) => (
              <li key={ev.public_id}>
                <Card variant="outlined">
                  <CardActionArea component={RouterLink} to={`/app/my-evaluations/${ev.public_id}`}>
                    <CardContent>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
                      >
                        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
                          {recipientName(ev.recipient)}
                        </Typography>
                        {ev.is_edited ? <Chip size="small" label="Edited" /> : null}
                        {ev.can_edit ? (
                          <Chip size="small" color="primary" variant="outlined" label="Editable" />
                        ) : null}
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {ev.cycle.name} · submitted {new Date(ev.submitted_at).toLocaleDateString()}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </li>
            ))}
          </Stack>
          {pageCount(list.data.count) > 1 ? (
            <Pagination
              count={pageCount(list.data.count)}
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
