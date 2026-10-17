import { zodResolver } from "@hookform/resolvers/zod";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { FormAlert } from "@/components/form/FormAlert";
import { PrivacyNotice } from "@/components/PrivacyNotice";
import { isApiError } from "@/lib/errors";
import { applyServerErrors } from "@/lib/forms";

import { buildDraftSchema, emptyDraft, type EvaluationDraft } from "../schema";
import { pointKey, type CycleForm, type MyEvaluation } from "../types";
import { EvaluationSummary } from "./EvaluationSummary";
import { RatingInput } from "./RatingInput";

const CHANGE_SUMMARY_MAX = 200;

interface EvaluationFormProps {
  form: CycleForm;
  recipientName: string;
  mode: "create" | "edit";
  initial?: EvaluationDraft;
  onConfirm: (draft: EvaluationDraft, changeSummary: string) => Promise<MyEvaluation>;
  onDone: (evaluation: MyEvaluation) => void;
  onCancel?: () => void;
}

/**
 * Two-step evaluation form (EVAL-07): edit → review with the privacy notice → confirm.
 * Used to submit (create) and to edit (MINE-02). The draft survives failed requests (NFR-04).
 */
export function EvaluationForm({
  form,
  recipientName,
  mode,
  initial,
  onConfirm,
  onDone,
  onCancel,
}: EvaluationFormProps) {
  const schema = useMemo(() => buildDraftSchema(form), [form]);
  const [step, setStep] = useState<"edit" | "review">("edit");
  const [changeSummary, setChangeSummary] = useState("");
  const [pending, setPending] = useState(false);
  const { control, handleSubmit, getValues, setError, formState } = useForm<EvaluationDraft>({
    resolver: zodResolver(schema),
    defaultValues: initial ?? emptyDraft(form),
  });
  const comment = useWatch({ control, name: "comment" });
  const suggestion = useWatch({ control, name: "suggestion" });
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (step === "review") reviewHeading.current?.focus(); // move focus for keyboard/screen readers
  }, [step]);

  const goToReview = handleSubmit(() => {
    setStep("review");
  });

  async function confirm() {
    setPending(true);
    try {
      onDone(await onConfirm(getValues(), changeSummary.trim()));
    } catch (error) {
      applyServerErrors(error, setError, ["ratings", "comment", "suggestion"]);
      if (isApiError(error) && Object.keys(error.fields).length > 0) setStep("edit");
    } finally {
      setPending(false);
    }
  }

  if (step === "review") {
    const values = getValues();
    return (
      <Stack spacing={3}>
        <Typography variant="h5" component="h2" tabIndex={-1} ref={reviewHeading}>
          {mode === "create" ? "Review your evaluation of" : "Review your changes for"}{" "}
          {recipientName}
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
        {mode === "edit" ? (
          <TextField
            label="What did you change? (optional)"
            value={changeSummary}
            onChange={(event) => {
              setChangeSummary(event.target.value);
            }}
            error={changeSummary.length > CHANGE_SUMMARY_MAX}
            helperText={`${String(changeSummary.length)}/${String(CHANGE_SUMMARY_MAX)} · Only you and the Super Admin see this.`}
          />
        ) : null}
        <PrivacyNotice />
        <FormAlert message={formState.errors.root?.server?.message} />
        <Stack direction={{ xs: "column-reverse", sm: "row" }} spacing={2}>
          <Button
            onClick={() => {
              setStep("edit");
            }}
            disabled={pending}
          >
            Back to edit
          </Button>
          <Button
            variant="contained"
            size="large"
            onClick={() => void confirm()}
            disabled={pending || changeSummary.length > CHANGE_SUMMARY_MAX}
          >
            {pending ? "Saving…" : mode === "create" ? "Submit evaluation" : "Save changes"}
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
      aria-label={`${mode === "create" ? "Evaluate" : "Edit evaluation of"} ${recipientName}`}
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
      <Stack direction={{ xs: "column-reverse", sm: "row" }} spacing={2}>
        {onCancel ? <Button onClick={onCancel}>Cancel</Button> : null}
        <Button type="submit" variant="contained" size="large">
          Review
        </Button>
      </Stack>
    </Stack>
  );
}
