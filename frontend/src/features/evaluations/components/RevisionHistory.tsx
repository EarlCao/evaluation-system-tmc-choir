import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { ErrorState } from "@/components/ErrorState";

import { useRevisions } from "../queries";
import { describeChanges } from "../revisions";
import type { Revision, RevisionSnapshot } from "../types";
import { EvaluationSummary } from "./EvaluationSummary";

function snapshotRatings(snapshot: RevisionSnapshot) {
  return snapshot.ratings.map((r) => ({
    name: r.criterion,
    value: r.value === null ? null : Number(r.value),
    label: r.label,
    max: Number.NaN,
  }));
}

function RevisionEntry({ revision, previous }: { revision: Revision; previous?: Revision }) {
  const changes = previous ? describeChanges(previous.snapshot, revision.snapshot) : [];
  return (
    <Paper component="li" variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600 }}>
            Revision {revision.revision_number}
          </Typography>
          <Chip size="small" label={revision.revision_number === 1 ? "Original" : "Edit"} />
          <Typography variant="body2" color="text.secondary">
            {new Date(revision.created_at).toLocaleString()} · by you
          </Typography>
        </Stack>
        {revision.change_summary ? (
          <Typography variant="body2">“{revision.change_summary}”</Typography>
        ) : null}
        {changes.length > 0 ? (
          <Stack component="ul" spacing={0.5} sx={{ pl: 2, m: 0 }} aria-label="Changes">
            {changes.map((c) => (
              <Typography component="li" variant="body2" key={c.key}>
                {c.text}
              </Typography>
            ))}
          </Stack>
        ) : null}
        <details>
          <summary>Show the content of revision {revision.revision_number}</summary>
          <Stack sx={{ mt: 1 }}>
            <EvaluationSummary
              ratings={snapshotRatings(revision.snapshot)}
              comment={revision.snapshot.comment}
              suggestion={revision.snapshot.suggestion}
            />
          </Stack>
        </details>
      </Stack>
    </Paper>
  );
}

/** MINE-04: original and edited content, time of each change, author-only. */
export function RevisionHistory({ publicId }: { publicId: string }) {
  const revisions = useRevisions(publicId);
  if (revisions.isPending) return null;
  if (revisions.isError) {
    return (
      <ErrorState
        message="We couldn't load the history."
        onRetry={() => void revisions.refetch()}
      />
    );
  }
  const ordered = [...revisions.data].sort((a, b) => b.revision_number - a.revision_number);
  return (
    <Stack spacing={2}>
      <Typography variant="h6" component="h2">
        History
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Only you and the Super Admin can see this history. The member sees the current version only.
      </Typography>
      <Stack
        component="ol"
        spacing={2}
        sx={{ listStyle: "none", p: 0, m: 0 }}
        aria-label="Revisions"
      >
        {ordered.map((revision) => (
          <RevisionEntry
            key={revision.revision_number}
            revision={revision}
            previous={revisions.data.find(
              (r) => r.revision_number === revision.revision_number - 1,
            )}
          />
        ))}
      </Stack>
    </Stack>
  );
}
