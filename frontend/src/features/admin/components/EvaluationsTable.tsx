import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
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
  selectedCriterion,
  currentSearch,
}: {
  rows: AdminEvaluation[];
  label: string;
  dimmed?: boolean;
  selectedCriterion?: string;
  currentSearch?: string;
}) {
  const searchParam = currentSearch ? `?${currentSearch}` : "";

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
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((e) => {
            const isSelf = e.is_self ?? (e.evaluator.public_id === e.recipient.public_id);
            const displayedRatings = selectedCriterion
              ? e.ratings.filter((r) => r.criterion_public_id === selectedCriterion)
              : e.ratings;

            return (
              <TableRow key={e.public_id} hover sx={{ height: 76 }}>
                <TableCell sx={{ verticalAlign: "top" }}>
                  <Link
                    component={RouterLink}
                    to={{ pathname: `/admin/evaluations/${e.public_id}`, search: searchParam }}
                    state={{ fromSearch: currentSearch }}
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
                <TableCell sx={{ verticalAlign: "top" }}>
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
                <TableCell sx={{ verticalAlign: "top" }}>
                  {personName(e.evaluator)}
                  {isSelf ? (
                    <Typography variant="caption" color="text.secondary" component="div">
                      (self)
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell sx={{ verticalAlign: "top" }}>{e.cycle.name}</TableCell>
                <TableCell sx={{ verticalAlign: "top", minWidth: 140 }}>
                  {selectedCriterion ? (
                    displayedRatings.length > 0 ? (
                      displayedRatings.map((r) => (
                        <Typography variant="body2" key={r.criterion_public_id} noWrap>
                          {r.criterion_name}: {formatRating(r)}
                        </Typography>
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        —
                      </Typography>
                    )
                  ) : (
                    <Box sx={{ maxHeight: 60, overflow: "hidden" }}>
                      {e.ratings.map((r) => (
                        <Typography variant="body2" key={r.criterion_public_id} noWrap>
                          {r.criterion_name}: {formatRating(r)}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </TableCell>
                <TableCell sx={{ maxWidth: 260, verticalAlign: "top" }}>
                  {e.comments && e.comments.length > 0 ? (
                    <Box>
                      <Box sx={{ maxHeight: 44, overflow: "hidden" }}>
                        <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                          <strong>
                            {e.comments[0].label ||
                              (e.comments[0].key === "comment"
                                ? "Comment"
                                : e.comments[0].key === "suggestion"
                                  ? "Suggestion"
                                  : e.comments[0].key)}
                            :
                          </strong>{" "}
                          {excerpt(e.comments[0].body, 70)}
                        </Typography>
                      </Box>
                      {e.comments.length > 1 ? (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                          +{e.comments.length - 1} more comment{e.comments.length > 2 ? "s" : ""}
                        </Typography>
                      ) : null}
                    </Box>
                  ) : e.comment ? (
                    <Box sx={{ maxHeight: 44, overflow: "hidden" }}>
                      <Typography variant="body2">{excerpt(e.comment.body, 70)}</Typography>
                    </Box>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell sx={{ verticalAlign: "top" }}>
                  <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
                    <ModerationChip status={e.moderation_status} />
                    {e.needs_attention ? (
                      <Chip size="small" color="warning" label="Needs review" />
                    ) : null}
                  </Stack>
                </TableCell>
                <TableCell align="right" sx={{ verticalAlign: "top", whiteSpace: "nowrap" }}>
                  <Button
                    component={RouterLink}
                    to={{ pathname: `/admin/evaluations/${e.public_id}`, search: searchParam }}
                    state={{ fromSearch: currentSearch }}
                    size="small"
                    variant="outlined"
                  >
                    View
                  </Button>
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
