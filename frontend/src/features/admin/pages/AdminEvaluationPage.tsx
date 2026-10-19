import Box from "@mui/material/Box";
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
import { ModerationChip, ModerationControls } from "../components/ModerationControls";
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
        spacing={2}
        sx={{
          listStyle: "none",
          p: 0,
          m: 0,
          maxHeight: 560,
          overflowY: "auto",
          pr: 1,
        }}
        aria-label="Revisions"
      >
        {[...all].reverse().map((r) => {
          const previous = all.find((p) => p.revision_number === r.revision_number - 1);
          const changes = previous ? describeChanges(previous.snapshot, r.snapshot) : [];

          // Normalize snapshot comments whether object or array
          const rawComments = r.snapshot.comments;
          const commentsList: { key: string; label: string; body: string }[] = Array.isArray(
            rawComments,
          )
            ? rawComments
            : rawComments && typeof rawComments === "object"
              ? Object.entries(rawComments).map(([k, v]) => ({
                  key: k,
                  label: k === "comment" ? "Comment" : k === "suggestion" ? "Suggestion" : k,
                  body: String(v),
                }))
              : [];

          return (
            <Paper component="li" variant="outlined" sx={{ p: 2 }} key={r.revision_number}>
              <Typography variant="subtitle2" component="h3">
                Revision {r.revision_number} · {formatDateTime(r.created_at)} · by{" "}
                {personName(r.editor)}
              </Typography>
              {r.change_summary ? (
                <Typography variant="body2" sx={{ fontStyle: "italic", mt: 0.5 }}>
                  “{r.change_summary}”
                </Typography>
              ) : null}
              {changes.length > 0 ? (
                <Stack spacing={0.5} sx={{ mt: 1 }}>
                  {changes.map((c) => (
                    <Typography variant="body2" color="text.secondary" key={c.key}>
                      {c.text}
                    </Typography>
                  ))}
                </Stack>
              ) : null}

              {/* Open revision content without accordion / arrow button: scroll to see full history */}
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    color: "text.secondary",
                    display: "block",
                    mb: 1,
                  }}
                >
                  Revision {r.revision_number} Content
                </Typography>
                <Stack spacing={0.75}>
                  {r.snapshot.ratings.map((x) => (
                    <Typography variant="body2" key={x.criterion_version_id}>
                      <strong>{x.criterion}:</strong> {x.value ?? "not rated"}
                      {x.label ? ` (${x.label})` : ""}
                    </Typography>
                  ))}
                  {commentsList.length > 0 ? (
                    commentsList.map((c) => (
                      <Typography variant="body2" key={c.key} sx={{ whiteSpace: "pre-wrap" }}>
                        <strong>{c.label || c.key}:</strong> {c.body || "—"}
                      </Typography>
                    ))
                  ) : (
                    <>
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        <strong>Comment:</strong> {r.snapshot.comment || "—"}
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        <strong>Suggestion:</strong> {r.snapshot.suggestion || "—"}
                      </Typography>
                    </>
                  )}
                </Stack>
              </Box>
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
  const isSelf = e.is_self ?? (e.evaluator.public_id === e.recipient.public_id);

  return (
    <Stack spacing={3} sx={{ py: 4, maxWidth: 900 }}>
      <Link component={RouterLink} to="/admin/evaluations">
        ← All evaluations
      </Link>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="h4" component="h1">
          {isSelf ? "Self-evaluation of " : "Evaluation of "}{personName(e.recipient)}
        </Typography>
        {isSelf ? (
          <Chip
            size="small"
            color="info"
            variant="outlined"
            label="Self-evaluation"
            sx={{ fontWeight: 700 }}
          />
        ) : null}
      </Stack>
      <IdentityAccessNotice />
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography>
            {isSelf ? (
              <>
                Self-evaluation by <PersonLink person={e.evaluator} />
              </>
            ) : (
              <>
                About <PersonLink person={e.recipient} /> · written by{" "}
                <PersonLink person={e.evaluator} />
              </>
            )}
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

      {/* Render all evaluation/comments (including self-evaluation comments) */}
      {e.comments && e.comments.length > 0 ? (
        e.comments.map((c) => (
          <Paper variant="outlined" sx={{ p: 2 }} key={c.key}>
            <Stack spacing={1}>
              <Typography variant="h6" component="h2">
                {c.label ||
                  (c.key === "comment"
                    ? "Comment"
                    : c.key === "suggestion"
                      ? "Suggestion"
                      : c.key)}
              </Typography>
              <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {c.body || <span style={{ color: "#888" }}>None written.</span>}
              </Typography>
              {c.key === "comment" || c.key === "suggestion" ? (
                <ModerationControls
                  evaluationId={e.public_id}
                  target={c.key === "comment" ? "COMMENT" : "SUGGESTION"}
                  status={c.moderation_status}
                />
              ) : (
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <ModerationChip status={c.moderation_status} />
                </Stack>
              )}
            </Stack>
          </Paper>
        ))
      ) : (
        <>
          <TextSection
            title="Comment"
            text={e.comment}
            evaluationId={e.public_id}
            target="COMMENT"
          />
          <TextSection
            title="Suggestion"
            text={e.suggestion}
            evaluationId={e.public_id}
            target="SUGGESTION"
          />
        </>
      )}

      <History evaluation={e} />
      <Revisions publicId={e.public_id} />
    </Stack>
  );
}
