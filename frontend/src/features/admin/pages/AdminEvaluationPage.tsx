import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { Link as RouterLink, useParams } from "react-router";

import { ErrorState } from "@/components/ErrorState";
import { FullPageSpinner } from "@/components/FullPageSpinner";
import { NotFoundPage } from "@/components/NotFoundPage";
import { describeChanges } from "@/features/evaluations";
import { formatDateTime } from "@/lib/datetime";
import { isApiError } from "@/lib/errors";

import { IdentityAccessNotice } from "../components/EvaluationsTable";
import { ModerationControls } from "../components/ModerationControls";
import { useAdminEvaluation, useAdminRevisions } from "../moderationQueries";
import {
  ACTION_LABEL,
  formatRating,
  personName,
  TARGET_LABEL,
  type AdminEvaluationDetail,
  type AdminText,
  type Person,
} from "../moderationTypes";

function PersonLink({ person }: { person: Person }) {
  return (
    <Link component={RouterLink} to={`/admin/members/${person.public_id}`}>
      {personName(person)}
    </Link>
  );
}

function TextSection({
  title,
  text,
  evaluationId,
  target,
}: {
  title: string;
  text: AdminText | null;
  evaluationId: string;
  target: "COMMENT" | "SUGGESTION";
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        {text ? (
          <>
            <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {text.body}
            </Typography>
            <ModerationControls
              evaluationId={evaluationId}
              target={target}
              status={text.moderation_status}
            />
          </>
        ) : (
          <Typography color="text.secondary">None written.</Typography>
        )}
      </Stack>
    </Paper>
  );
}

function Revisions({ publicId }: { publicId: string }) {
  const revisions = useAdminRevisions(publicId);
  if (revisions.isPending) return null;
  if (revisions.isError)
    return (
      <ErrorState
        message="We couldn't load the history."
        onRetry={() => void revisions.refetch()}
      />
    );
  const all = revisions.data;
  return (
    <Stack spacing={1}>
      <Typography variant="h6" component="h2">
        Revisions
      </Typography>
      <Stack
        component="ol"
        spacing={1}
        sx={{ listStyle: "none", p: 0, m: 0 }}
        aria-label="Revisions"
      >
        {[...all].reverse().map((r) => {
          const previous = all.find((p) => p.revision_number === r.revision_number - 1);
          const changes = previous ? describeChanges(previous.snapshot, r.snapshot) : [];
          return (
            <Paper component="li" variant="outlined" sx={{ p: 2 }} key={r.revision_number}>
              <Typography variant="subtitle2" component="h3">
                Revision {r.revision_number} · {formatDateTime(r.created_at)} · by{" "}
                {personName(r.editor)}
              </Typography>
              {r.change_summary ? (
                <Typography variant="body2">“{r.change_summary}”</Typography>
              ) : null}
              {changes.map((c) => (
                <Typography variant="body2" key={c.key}>
                  {c.text}
                </Typography>
              ))}
              <details>
                <summary>Show the content of revision {r.revision_number}</summary>
                <Stack spacing={0.5} sx={{ mt: 1 }}>
                  {r.snapshot.ratings.map((x) => (
                    <Typography variant="body2" key={x.criterion_version_id}>
                      {x.criterion}: {x.value ?? "not rated"}
                    </Typography>
                  ))}
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    Comment: {r.snapshot.comment || "—"}
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    Suggestion: {r.snapshot.suggestion || "—"}
                  </Typography>
                </Stack>
              </details>
            </Paper>
          );
        })}
      </Stack>
    </Stack>
  );
}

function History({ evaluation }: { evaluation: AdminEvaluationDetail }) {
  return (
    <Stack spacing={1}>
      <Typography variant="h6" component="h2">
        Moderation history
      </Typography>
      {evaluation.moderation_history.length === 0 ? (
        <Typography color="text.secondary">No moderation decisions yet.</Typography>
      ) : (
        <Stack component="ul" spacing={0.5} sx={{ pl: 2, m: 0 }} aria-label="Moderation history">
          {evaluation.moderation_history.map((h) => (
            <Typography
              component="li"
              variant="body2"
              key={`${h.created_at}-${h.action}-${h.target}`}
            >
              {formatDateTime(h.created_at)}: {ACTION_LABEL[h.action]} the {TARGET_LABEL[h.target]}{" "}
              by {h.actor}
              {h.reason ? ` — “${h.reason}”` : ""}
            </Typography>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

/** ADM-02 / ADM-03 / ADM-05: one evaluation with its author, revisions and moderation. */
export function AdminEvaluationPage() {
  const { publicId = "" } = useParams();
  const evaluation = useAdminEvaluation(publicId);
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
  const e = evaluation.data;
  return (
    <Stack spacing={3} sx={{ py: 4, maxWidth: 900 }}>
      <Link component={RouterLink} to="/admin/evaluations">
        ← All evaluations
      </Link>
      <Typography variant="h4" component="h1">
        Evaluation of {personName(e.recipient)}
      </Typography>
      <IdentityAccessNotice />
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography>
            About <PersonLink person={e.recipient} /> · written by{" "}
            <PersonLink person={e.evaluator} />
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {e.cycle.name} · submitted {formatDateTime(e.submitted_at)}
            {e.is_edited ? ` · last edited ${formatDateTime(e.last_edited_at)}` : ""}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="body2">Whole evaluation:</Typography>
            <ModerationControls
              evaluationId={e.public_id}
              target="EVALUATION"
              status={e.moderation_status}
            />
            {e.needs_attention ? <Chip size="small" color="warning" label="Needs review" /> : null}
          </Stack>
        </Stack>
      </Paper>

      <Paper variant="outlined">
        <Table size="small" aria-label="Ratings">
          <TableHead>
            <TableRow>
              <TableCell>Criterion</TableCell>
              <TableCell>Rating</TableCell>
              <TableCell>Label</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {e.ratings.map((r) => (
              <TableRow key={r.criterion_public_id}>
                <TableCell>
                  {r.criterion_name}{" "}
                  <Typography component="span" variant="caption" color="text.secondary">
                    v{r.criterion_version}
                  </Typography>
                </TableCell>
                <TableCell>{formatRating(r)}</TableCell>
                <TableCell>{r.label || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <TextSection title="Comment" text={e.comment} evaluationId={e.public_id} target="COMMENT" />
      <TextSection
        title="Suggestion"
        text={e.suggestion}
        evaluationId={e.public_id}
        target="SUGGESTION"
      />
      <History evaluation={e} />
      <Revisions publicId={e.public_id} />
    </Stack>
  );
}
