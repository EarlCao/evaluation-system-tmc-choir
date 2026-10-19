import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { Link as RouterLink } from "react-router";

import { formatRating, personName, type AdminEvaluation } from "../moderationTypes";
import { ModerationChip } from "./ModerationControls";

function excerpt(text: string, max = 80) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Shared by the evaluations browser and the moderation queue (ADM-02/05). */
export function EvaluationsTable({
  rows,
  label,
  dimmed = false,
}: {
  rows: AdminEvaluation[];
  label: string;
  dimmed?: boolean;
}) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ opacity: dimmed ? 0.6 : 1 }}>
      <Table size="small" aria-label={label}>
        <TableHead>
          <TableRow>
            <TableCell>Submitted</TableCell>
            <TableCell>About</TableCell>
            <TableCell>From</TableCell>
            <TableCell>Period</TableCell>
            <TableCell>Ratings</TableCell>
            <TableCell>Comment</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((e) => {
            const isSelf = e.is_self ?? (e.evaluator.public_id === e.recipient.public_id);
            return (
              <TableRow key={e.public_id} hover>
                <TableCell>
                  <Link
                    component={RouterLink}
                    to={`/admin/evaluations/${e.public_id}`}
                    aria-label={`Open the evaluation of ${personName(e.recipient)} by ${personName(e.evaluator)}`}
                  >
                    {new Date(e.submitted_at).toLocaleDateString()}
                  </Link>
                  {e.is_edited ? (
                    <Typography variant="caption" color="text.secondary" component="div">
                      edited
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
                    <span>{personName(e.recipient)}</span>
                    {isSelf ? (
                      <Chip
                        size="small"
                        label="Self-evaluation"
                        color="info"
                        variant="outlined"
                        sx={{ fontWeight: 600, height: 20, fontSize: "0.75rem" }}
                      />
                    ) : null}
                  </Stack>
                </TableCell>
                <TableCell>
                  {personName(e.evaluator)}
                  {isSelf ? (
                    <Typography variant="caption" color="text.secondary" component="div">
                      (self)
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell>{e.cycle.name}</TableCell>
                <TableCell>
                  {e.ratings.map((r) => (
                    <Typography variant="body2" key={r.criterion_public_id} noWrap>
                      {r.criterion_name}: {formatRating(r)}
                    </Typography>
                  ))}
                </TableCell>
                <TableCell sx={{ maxWidth: 280 }}>
                  {e.comments && e.comments.length > 0 ? (
                    <Stack spacing={0.5}>
                      {e.comments.map((c) => (
                        <Typography variant="body2" key={c.key} sx={{ overflowWrap: "anywhere" }}>
                          <strong>
                            {c.label ||
                              (c.key === "comment"
                                ? "Comment"
                                : c.key === "suggestion"
                                  ? "Suggestion"
                                  : c.key)}
                            :
                          </strong>{" "}
                          {excerpt(c.body, 70)}
                        </Typography>
                      ))}
                    </Stack>
                  ) : e.comment ? (
                    excerpt(e.comment.body)
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
                    <ModerationChip status={e.moderation_status} />
                    {e.needs_attention ? (
                      <Chip size="small" color="warning" label="Needs review" />
                    ) : null}
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function IdentityAccessNotice() {
  return (
    <Typography variant="body2" color="text.secondary">
      This page shows who wrote each evaluation. Members never see this. Every page you open here is
      recorded in the audit log.
    </Typography>
  );
}
