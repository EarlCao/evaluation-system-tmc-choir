import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { Link as RouterLink, useParams } from "react-router";

import { ErrorState } from "@/components/ErrorState";
import { FullPageSpinner } from "@/components/FullPageSpinner";
import { NotFoundPage } from "@/components/NotFoundPage";
import { isApiError } from "@/lib/errors";

import { EvaluationForm } from "../components/EvaluationForm";
import { EvaluationSummary } from "../components/EvaluationSummary";
import { RevisionHistory } from "../components/RevisionHistory";
import { useCycleForm, useEditEvaluation, useMyEvaluation } from "../queries";
import type { EvaluationDraft } from "../schema";
import { recipientName, type MyEvaluation } from "../types";

function toDraft(ev: MyEvaluation): EvaluationDraft {
  return {
    ratings: Object.fromEntries(ev.ratings.map((r) => [String(r.criterion_version.id), r.value])),
    comment: ev.comment,
    suggestion: ev.suggestion,
  };
}

function EditPanel({ ev, onClose }: { ev: MyEvaluation; onClose: (saved: boolean) => void }) {
  // The cycle's form version is frozen once open, so it is the evaluation's own form (BR-07).
  const form = useCycleForm(ev.cycle.public_id);
  const edit = useEditEvaluation(ev.public_id);
  if (form.isPending) return <FullPageSpinner label="Loading form" />;
  if (form.isError) {
    return <ErrorState message="We couldn't load the form." onRetry={() => void form.refetch()} />;
  }
  return (
    <EvaluationForm
      form={form.data}
      recipientName={recipientName(ev.recipient)}
      mode="edit"
      initial={toDraft(ev)}
      onConfirm={(draft, changeSummary) =>
        edit.mutateAsync({
          ratings: form.data.criteria.map((c) => ({
            criterion_version: c.criterion_version,
            value: draft.ratings[String(c.criterion_version)] ?? null,
          })),
          comment: draft.comment,
          suggestion: draft.suggestion,
          change_summary: changeSummary,
        })
      }
      onDone={() => {
        onClose(true);
      }}
      onCancel={() => {
        onClose(false);
      }}
    />
  );
}

/** MINE-01..04: the author's own evaluation, editable within the window, with its history. */
export function MyEvaluationDetailPage() {
  const { publicId = "" } = useParams();
  const evaluation = useMyEvaluation(publicId);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

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

      {saved ? (
        <Alert severity="success" role="status">
          Your changes were saved as revision {ev.current_revision_number}.
        </Alert>
      ) : null}

      {editing ? (
        <EditPanel
          ev={ev}
          onClose={(didSave) => {
            setEditing(false);
            setSaved(didSave);
          }}
        />
      ) : (
        <>
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
          {ev.can_edit ? (
            <div>
              <Button
                variant="outlined"
                onClick={() => {
                  setSaved(false);
                  setEditing(true);
                }}
              >
                Edit evaluation
              </Button>
            </div>
          ) : (
            <Typography variant="body2" color="text.secondary">
              The edit window for this evaluation has closed.
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {ev.recipient.first_name} sees this feedback without your name
            {ev.is_edited ? " and sees that it was edited, but not by whom" : ""}. Only you and the
            Super Admin can see that you wrote it.
          </Typography>
          <RevisionHistory publicId={ev.public_id} />
        </>
      )}
    </Stack>
  );
}
