import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Link as RouterLink, useParams } from "react-router";

import { ErrorState } from "@/components/ErrorState";
import { FormAlert } from "@/components/form/FormAlert";
import { FullPageSpinner } from "@/components/FullPageSpinner";
import { NotFoundPage } from "@/components/NotFoundPage";
import { PrivacyNotice } from "@/components/PrivacyNotice";
import { memberName, useMember } from "@/features/members";
import { isApiError } from "@/lib/errors";
import { applyServerErrors } from "@/lib/forms";

import { EvaluationSummary } from "../components/EvaluationSummary";
import { RatingInput } from "../components/RatingInput";
import { useCurrentCycle, useCycleForm, useEligibility, useSubmitEvaluation } from "../queries";
import { buildDraftSchema, emptyDraft, type EvaluationDraft } from "../schema";
import { pointKey, type CycleForm, type MyEvaluation } from "../types";

function EvaluationForm({
  form,
  recipientPublicId,
  recipientName,
  onDone,
}: {
  form: CycleForm;
  recipientPublicId: string;
  recipientName: string;
  onDone: (evaluation: MyEvaluation) => void;
}) {
  const schema = useMemo(() => buildDraftSchema(form), [form]);
  const [step, setStep] = useState<"edit" | "review">("edit");
  const submit = useSubmitEvaluation();
  const { control, handleSubmit, getValues, setError, formState } = useForm<EvaluationDraft>({
    resolver: zodResolver(schema),
    defaultValues: emptyDraft(form),
  });
  const comment = useWatch({ control, name: "comment" });
  const suggestion = useWatch({ control, name: "suggestion" });
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (step === "review") reviewHeading.current?.focus(); // move focus for keyboard/screen readers
  }, [step]);

  // Step 1 → 2: validate on the client, then show the review (EVAL-07).
  const goToReview = handleSubmit(() => {
    setStep("review");
  });

  async function confirm() {
    const values = getValues();
    try {
      const evaluation = await submit.mutateAsync({
        recipient: recipientPublicId,
        ratings: form.criteria.map((c) => ({
          criterion_version: c.criterion_version,
          value: values.ratings[String(c.criterion_version)] ?? null,
        })),
        comment: values.comment,
        suggestion: values.suggestion,
      });
      onDone(evaluation);
    } catch (error) {
      // Keep the draft (NFR-04); field errors send the user back to the form.
      applyServerErrors(error, setError, ["ratings", "comment", "suggestion"]);
      if (isApiError(error) && Object.keys(error.fields).length > 0) setStep("edit");
    }
  }

  if (step === "review") {
    const values = getValues();
    return (
      <Stack spacing={3}>
        <Typography variant="h5" component="h2" tabIndex={-1} ref={reviewHeading}>
          Review your evaluation of {recipientName}
        </Typography>
        <Paper variant="outlined" sx={{ p: 3 }}>
          <EvaluationSummary
            ratings={form.criteria.map((c) => {
              const v = values.ratings[String(c.criterion_version)] ?? null;
              return {
                name: c.name,
                value: v,
                label: v === null ? "" : (c.labels[pointKey(v)] ?? ""),
                max: c.max_value,
              };
            })}
            comment={values.comment.trim()}
            suggestion={values.suggestion.trim()}
          />
        </Paper>
        <PrivacyNotice />
        <FormAlert message={formState.errors.root?.server?.message} />
        <Stack direction={{ xs: "column-reverse", sm: "row" }} spacing={2}>
          <Button
            onClick={() => {
              setStep("edit");
            }}
            disabled={submit.isPending}
          >
            Back to edit
          </Button>
          <Button
            variant="contained"
            size="large"
            onClick={() => void confirm()}
            disabled={submit.isPending}
          >
            {submit.isPending ? "Submitting…" : "Submit evaluation"}
          </Button>
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack
      component="form"
      spacing={3}
      noValidate
      onSubmit={goToReview}
      aria-label={`Evaluate ${recipientName}`}
    >
      <FormAlert message={formState.errors.root?.server?.message} />
      {form.criteria.map((criterion) => (
        <Controller
          key={criterion.criterion_version}
          control={control}
          name={`ratings.${String(criterion.criterion_version)}`}
          render={({ field, fieldState }) => (
            <RatingInput
              criterion={criterion}
              value={field.value ?? null}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
      ))}

      <Controller
        control={control}
        name="comment"
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            label={form.comment_required ? "Comment" : "Comment (optional)"}
            multiline
            minRows={3}
            error={Boolean(fieldState.error)}
            helperText={
              fieldState.error?.message ??
              `${String(comment.length)}/${String(form.comment_max_length)} · Be specific and constructive.`
            }
          />
        )}
      />
      <Controller
        control={control}
        name="suggestion"
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            label={form.suggestion_required ? "Suggestion" : "Suggestion (optional)"}
            multiline
            minRows={2}
            error={Boolean(fieldState.error)}
            helperText={
              fieldState.error?.message ??
              `${String(suggestion.length)}/${String(form.suggestion_max_length)} · What could help them grow?`
            }
          />
        )}
      />
      <div>
        <Button type="submit" variant="contained" size="large">
          Review
        </Button>
      </div>
    </Stack>
  );
}

/** EVAL-01: evaluate a member in the open cycle. */
export function EvaluateMemberPage() {
  const { publicId = "" } = useParams();
  const member = useMember(publicId);
  const eligibility = useEligibility(publicId);
  const cycle = useCurrentCycle();
  const form = useCycleForm(cycle.data?.public_id);
  const [done, setDone] = useState<MyEvaluation | null>(null);

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
  const verdict = eligibility.data;

  return (
    <Stack spacing={3} sx={{ py: 4, maxWidth: 760 }}>
      <div>
        <Typography variant="h4" component="h1">
          Evaluate {name}
        </Typography>
        {cycle.data ? (
          <Typography color="text.secondary">
            {cycle.data.name} · open until {new Date(cycle.data.ends_at).toLocaleDateString()}
          </Typography>
        ) : null}
      </div>

      {done ? (
        <Stack spacing={2}>
          <Alert severity="success" role="status">
            Thank you! Your evaluation of {name} was submitted.
          </Alert>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Button
              component={RouterLink}
              to={`/app/my-evaluations/${done.public_id}`}
              variant="contained"
            >
              View your evaluation
            </Button>
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
          recipientPublicId={publicId}
          recipientName={name}
          onDone={setDone}
        />
      )}
    </Stack>
  );
}
