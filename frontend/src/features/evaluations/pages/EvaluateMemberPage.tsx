import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router";

import { ErrorState } from "@/components/ErrorState";
import { FullPageSpinner } from "@/components/FullPageSpinner";
import { NotFoundPage } from "@/components/NotFoundPage";
import { memberName, useMember } from "@/features/members";
import { isApiError } from "@/lib/errors";

import { EvaluationForm } from "../components/EvaluationForm";
import { clearEvaluationDraft, loadEvaluationDraft } from "../draftStorage";
import { useCurrentCycle, useCycleForm, useEligibility, useSubmitEvaluation } from "../queries";
import type { MyEvaluation } from "../types";

/** EVAL-01: evaluate a member in the open cycle. */
export function EvaluateMemberPage() {
  const { publicId = "" } = useParams();
  const navigate = useNavigate();
  const member = useMember(publicId);
  const eligibility = useEligibility(publicId);
  const cycle = useCurrentCycle();
  const form = useCycleForm(cycle.data?.public_id);
  const submit = useSubmitEvaluation();
  const [done, setDone] = useState<MyEvaluation | null>(null);

  const cycleId = cycle.data?.public_id;
  const initialDraft = useMemo(() => {
    if (!cycleId || !publicId) return undefined;
    return loadEvaluationDraft(cycleId, publicId) ?? undefined;
  }, [cycleId, publicId]);

  if (member.isPending || eligibility.isPending || cycle.isPending) {
    return <FullPageSpinner label="Loading evaluation form" />;
  }
  if (member.isError) {
    if (isApiError(member.error) && member.error.status === 404) return <NotFoundPage />;
    return (
      <ErrorState message="We couldn't load this member." onRetry={() => void member.refetch()} />
    );
  }
  if (eligibility.isError || cycle.isError) {
    return (
      <ErrorState
        message="We couldn't load the evaluation form."
        onRetry={() => {
          void eligibility.refetch();
          void cycle.refetch();
        }}
      />
    );
  }

  const name = memberName(member.data);
  const isSelf = member.data.is_self;
  const verdict = eligibility.data;

  return (
    <Stack spacing={3} sx={{ py: 4, maxWidth: 760 }}>
      <Box>
        <Button
          component={RouterLink}
          to="/app/members"
          startIcon={
            <SvgIcon fontSize="small">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </SvgIcon>
          }
          sx={{ textTransform: "none", color: "text.secondary", pl: 0 }}
        >
          Back to members
        </Button>
      </Box>

      <div>
        <Typography variant="h4" component="h1">
          {isSelf ? `Evaluate yourself (${name})` : `Evaluate ${name}`}
        </Typography>
        {cycle.data ? (
          <Typography color="text.secondary">
            {cycle.data.name} · open until {new Date(cycle.data.ends_at).toLocaleDateString()}
          </Typography>
        ) : null}
      </div>

      {isSelf && !done ? (
        <Alert severity="info">
          <strong>Public Self-Evaluation:</strong> Your self-evaluation ratings and comments will be
          displayed publicly on your member profile so all choir members can view them.
        </Alert>
      ) : null}

      {done ? (
        <Stack spacing={2}>
          <Alert severity="success" role="status">
            {isSelf
              ? "Thank you! Your public self-evaluation was submitted and is now visible on your profile."
              : `Thank you! Your evaluation of ${name} was submitted.`}
          </Alert>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Button
              component={RouterLink}
              to={`/app/my-evaluations/${done.public_id}`}
              variant="contained"
            >
              View your evaluation
            </Button>
            {isSelf ? (
              <Button component={RouterLink} to={`/app/members/${publicId}`} variant="outlined">
                View your public profile
              </Button>
            ) : null}
            <Button component={RouterLink} to="/app/members">
              Evaluate someone else
            </Button>
          </Stack>
        </Stack>
      ) : !verdict.can_evaluate ? (
        <Stack spacing={2}>
          <Alert severity="info">{verdict.message}</Alert>
          {verdict.existing_evaluation ? (
            <div>
              <Button
                component={RouterLink}
                to={`/app/my-evaluations/${verdict.existing_evaluation}`}
                variant="outlined"
              >
                Open your evaluation
              </Button>
            </div>
          ) : null}
        </Stack>
      ) : form.isPending ? (
        <FullPageSpinner label="Loading evaluation form" />
      ) : form.isError ? (
        <ErrorState
          message="We couldn't load the evaluation form."
          onRetry={() => void form.refetch()}
        />
      ) : (
        <EvaluationForm
          form={form.data}
          recipientName={name}
          recipientId={publicId}
          cycleId={cycleId}
          isSelf={isSelf}
          mode="create"
          initial={initialDraft}
          onConfirm={(draft) =>
            submit.mutateAsync({
              recipient: publicId,
              ratings: form.data.criteria.map((c) => ({
                criterion_version: c.criterion_version,
                value: draft.ratings[String(c.criterion_version)] ?? null,
              })),
              comment: draft.comment,
              suggestion: draft.suggestion,
              comments: draft.comments,
            })
          }
          onDone={(evalResult) => {
            if (cycleId && publicId) {
              clearEvaluationDraft(cycleId, publicId);
            }
            setDone(evalResult);
          }}
          onCancel={() => navigate("/app/members")}
        />
      )}
    </Stack>
  );
}
