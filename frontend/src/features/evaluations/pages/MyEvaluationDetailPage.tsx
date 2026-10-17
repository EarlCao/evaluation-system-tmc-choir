import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Link as RouterLink, useParams } from "react-router";

import { ErrorState } from "@/components/ErrorState";
import { FullPageSpinner } from "@/components/FullPageSpinner";
import { NotFoundPage } from "@/components/NotFoundPage";
import { isApiError } from "@/lib/errors";

import { EvaluationSummary } from "../components/EvaluationSummary";
import { useMyEvaluation } from "../queries";
import { recipientName } from "../types";

/** MINE-01: one of the member's own evaluations (editing and history arrive in step 3.3). */
export function MyEvaluationDetailPage() {
  const { publicId = "" } = useParams();
  const evaluation = useMyEvaluation(publicId);

  if (evaluation.isPending) return <FullPageSpinner label="Loading evaluation" />;
  if (evaluation.isError) {
    if (isApiError(evaluation.error) && evaluation.error.status === 404) return <NotFoundPage />;
    return (
      <ErrorState
        message="We couldn't load this evaluation."
        onRetry={() => void evaluation.refetch()}
      />
    );
  }

  const ev = evaluation.data;
  return (
    <Stack spacing={3} sx={{ py: 4, maxWidth: 760 }}>
      <Link component={RouterLink} to="/app/my-evaluations">
        ← My evaluations
      </Link>
      <div>
        <Typography variant="h4" component="h1">
          Your evaluation of {recipientName(ev.recipient)}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: "center", flexWrap: "wrap" }}>
          <Typography color="text.secondary">
            {ev.cycle.name} · submitted {new Date(ev.submitted_at).toLocaleString()}
          </Typography>
          {ev.is_edited ? <Chip size="small" label="Edited" /> : null}
        </Stack>
      </div>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <EvaluationSummary
          ratings={ev.ratings.map((r) => ({
            name: r.criterion_version.name,
            value: r.value,
            label: r.label,
            max: r.criterion_version.max_value,
          }))}
          comment={ev.comment}
          suggestion={ev.suggestion}
        />
      </Paper>
      <Typography variant="body2" color="text.secondary">
        {ev.recipient.first_name} sees this feedback without your name. Only you and the Super Admin
        can see that you wrote it.
      </Typography>
    </Stack>
  );
}
