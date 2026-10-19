import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { pointKey, type MyCommentEntry } from "../types";

export interface SummaryRating {
  name: string;
  value: number | null;
  label: string;
  max: number;
}

interface EvaluationSummaryProps {
  ratings: SummaryRating[];
  comment: string;
  suggestion: string;
  comments?: MyCommentEntry[];
}

/** Read-only view of an evaluation's content (review step and detail page). Text only. */
export function EvaluationSummary({
  ratings,
  comment,
  suggestion,
  comments,
}: EvaluationSummaryProps) {
  return (
    <Stack spacing={2}>
      <Stack component="dl" spacing={1} sx={{ m: 0 }}>
        {ratings.map((r) => (
          <Stack key={r.name} direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
            <Typography component="dt">{r.name}</Typography>
            <Typography component="dd" sx={{ m: 0, fontWeight: 600, textAlign: "right" }}>
              {r.value === null
                ? "Not rated"
                : `${pointKey(r.value)}${Number.isFinite(r.max) ? ` / ${pointKey(r.max)}` : ""}${r.label ? ` · ${r.label}` : ""}`}
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Divider />
      {comments && comments.length > 0 ? (
        comments.map((entry, idx) => (
          <div key={entry.key}>
            <Typography variant="subtitle2" component="h3">
              {idx + 1}. {entry.label}
            </Typography>
            <Typography
              sx={{ whiteSpace: "pre-wrap" }}
              color={entry.body ? "text.primary" : "text.secondary"}
            >
              {entry.body || "No response."}
            </Typography>
          </div>
        ))
      ) : (
        <>
          <div>
            <Typography variant="subtitle2" component="h3">
              1. Comments (Unsay imong ikaingon sa akoa?)
            </Typography>
            <Typography
              sx={{ whiteSpace: "pre-wrap" }}
              color={comment ? "text.primary" : "text.secondary"}
            >
              {comment || "No comment."}
            </Typography>
          </div>
          <div>
            <Typography variant="subtitle2" component="h3">
              2. Suggestions (Unsay imong ikasuggest sa akoa?)
            </Typography>
            <Typography
              sx={{ whiteSpace: "pre-wrap" }}
              color={suggestion ? "text.primary" : "text.secondary"}
            >
              {suggestion || "No suggestion."}
            </Typography>
          </div>
        </>
      )}
    </Stack>
  );
}
