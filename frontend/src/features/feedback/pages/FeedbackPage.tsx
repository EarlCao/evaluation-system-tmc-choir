import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSearchParams } from "react-router";

import { ErrorState } from "@/components/ErrorState";
import { pageCount } from "@/lib/pagination";

import { CriterionTile } from "../components/CriterionTile";
import { TrendChart } from "../components/TrendChart";
import { useFeedbackSummary, useReceivedFeedback } from "../queries";

/** FB-06: say clearly what is anonymous and who can see identities. */
function AnonymityBanner() {
  return (
    <Alert severity="info" variant="outlined">
      <AlertTitle>This feedback is anonymous to you</AlertTitle>
      You never see who wrote an evaluation, and neither do other members. The Super Admin can see
      who submitted each evaluation. Averages appear once enough members have rated you.
    </Alert>
  );
}

function FeedbackList({ cycle }: { cycle: string }) {
  const [params, setParams] = useSearchParams();
  const dateFrom = params.get("from") ?? "";
  const dateTo = params.get("to") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const list = useReceivedFeedback({ cycle, date_from: dateFrom, date_to: dateTo, page });

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  }

  return (
    <Stack spacing={2} component="section" aria-labelledby="comments-heading">
      <Typography variant="h6" component="h2" id="comments-heading">
        Comments and suggestions
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          label="Comments from"
          type="date"
          value={dateFrom}
          onChange={(e) => {
            update({ from: e.target.value, page: "" });
          }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="Comments until"
          type="date"
          value={dateTo}
          onChange={(e) => {
            update({ to: e.target.value, page: "" });
          }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Stack>
      {list.isError ? (
        <ErrorState message="We couldn't load your feedback." onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <Skeleton variant="rounded" height={96} />
      ) : list.data.results.length === 0 ? (
        <Typography color="text.secondary">No comments or suggestions yet.</Typography>
      ) : (
        <Stack
          component="ul"
          spacing={2}
          aria-label="Feedback"
          sx={{ listStyle: "none", p: 0, m: 0, opacity: list.isPlaceholderData ? 0.6 : 1 }}
        >
          {list.data.results.map((item) => (
            <Paper component="li" variant="outlined" key={item.feedback_id} sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                  <Typography variant="body2" color="text.secondary">
                    {item.cycle.name} · {new Date(`${item.date}T00:00:00`).toLocaleDateString()}
                  </Typography>
                  {item.is_edited ? <Chip size="small" label="Edited" /> : null}
                </Stack>
                {item.comments && item.comments.length > 0 ? (
                  item.comments.map((entry, idx) => (
                    <Typography key={entry.key} sx={{ whiteSpace: "pre-wrap" }}>
                      <strong>
                        {idx + 1}. {entry.label}:
                      </strong>{" "}
                      {entry.body}
                    </Typography>
                  ))
                ) : (
                  <>
                    {item.comment ? (
                      <Typography sx={{ whiteSpace: "pre-wrap" }}>{item.comment}</Typography>
                    ) : null}
                    {item.suggestion ? (
                      <Typography sx={{ whiteSpace: "pre-wrap" }}>
                        <strong>Suggestion:</strong> {item.suggestion}
                      </Typography>
                    ) : null}
                  </>
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
      {list.data && pageCount(list.data.count) > 1 ? (
        <Pagination
          count={pageCount(list.data.count)}
          page={page}
          onChange={(_, value) => {
            update({ page: value > 1 ? String(value) : "" });
          }}
          sx={{ alignSelf: "center" }}
        />
      ) : null}
    </Stack>
  );
}

/** FB-01..06: feedback the member received, anonymised by the server. */
export function FeedbackPage() {
  const [params, setParams] = useSearchParams();
  const cycle = params.get("cycle") ?? "";
  const all = useFeedbackSummary(); // also provides the cycle options
  const summary = useFeedbackSummary(cycle);

  return (
    <Stack spacing={3} sx={{ py: 4 }}>
      <Typography variant="h4" component="h1">
        Feedback I received
      </Typography>
      <AnonymityBanner />

      {/* One filter row above everything it scopes (dataviz interaction rules). */}
      <TextField
        select
        label="Evaluation period"
        value={cycle}
        onChange={(e) => {
          const next = new URLSearchParams();
          if (e.target.value) next.set("cycle", e.target.value);
          setParams(next, { replace: true });
        }}
        sx={{ maxWidth: 320 }}
      >
        <MenuItem value="">All periods</MenuItem>
        {(all.data?.trend ?? []).map((t) => (
          <MenuItem key={t.cycle.public_id} value={t.cycle.public_id}>
            {t.cycle.name}
          </MenuItem>
        ))}
      </TextField>

      {summary.isError ? (
        <ErrorState
          message="We couldn't load your summary."
          onRetry={() => void summary.refetch()}
        />
      ) : summary.isPending ? (
        <Skeleton variant="rounded" height={120} />
      ) : (
        <Stack spacing={3} sx={{ opacity: summary.isPlaceholderData ? 0.6 : 1 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" component="h2">
                    Evaluations received
                  </Typography>
                  <Typography variant="h3" component="p" sx={{ fontWeight: 600 }}>
                    {summary.data.evaluations_received}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            {summary.data.criteria.map((c) => (
              <Grid key={c.criterion_public_id + c.criterion} size={{ xs: 12, sm: 6, md: 4 }}>
                <CriterionTile summary={c} threshold={summary.data.threshold} />
              </Grid>
            ))}
          </Grid>

          {!cycle && summary.data.trend.length > 1 ? (
            <Paper
              variant="outlined"
              sx={{ p: 2 }}
              component="section"
              aria-labelledby="trend-heading"
            >
              <Typography variant="h6" component="h2" id="trend-heading">
                Average rating per evaluation period
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                As a percentage of each scale, so periods with different scales compare fairly.
                Periods with fewer than {summary.data.threshold} evaluations are left out.
              </Typography>
              <TrendChart trend={summary.data.trend} />
            </Paper>
          ) : null}
        </Stack>
      )}

      <FeedbackList cycle={cycle} />
    </Stack>
  );
}
