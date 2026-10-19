import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { FormAlert } from "@/components/form/FormAlert";
import { PrivacyNotice } from "@/components/PrivacyNotice";
import { useCurrentUser } from "@/features/auth";
import { isApiError } from "@/lib/errors";
import { applyServerErrors } from "@/lib/forms";

import { ownNameMentions } from "../identity";
import { buildDraftSchema, countWords, emptyDraft, type EvaluationDraft } from "../schema";
import {
  effectiveCommentPrompts,
  pointKey,
  type CycleForm,
  type FormCommentPrompt,
  type MyEvaluation,
} from "../types";
import { EvaluationSummary } from "./EvaluationSummary";
import { RatingInput } from "./RatingInput";

const CHANGE_SUMMARY_MAX = 200;

type Step = "criteria" | "comments" | "review";

interface EvaluationFormProps {
  form: CycleForm;
  recipientName: string;
  isSelf?: boolean;
  mode: "create" | "edit";
  initial?: EvaluationDraft;
  onConfirm: (draft: EvaluationDraft, changeSummary: string) => Promise<MyEvaluation>;
  onDone: (evaluation: MyEvaluation) => void;
  onCancel?: () => void;
}

function normalizeInitialDraft(form: CycleForm, initial?: EvaluationDraft): EvaluationDraft {
  const base = emptyDraft(form);
  if (!initial) return base;
  const comments: Record<string, string> = {
    ...base.comments,
    ...(initial.comments ?? {}),
  };
  if (initial.comment && !comments.comment) {
    comments.comment = initial.comment;
  }
  if (initial.suggestion && !comments.suggestion) {
    comments.suggestion = initial.suggestion;
  }
  return {
    ratings: { ...base.ratings, ...initial.ratings },
    comment: comments.comment ?? initial.comment ?? "",
    suggestion: comments.suggestion ?? initial.suggestion ?? "",
    comments,
  };
}

/**
 * Three-step evaluation form (EVAL-07):
 * Step 1: Criteria ratings → Step 2: Numbered comment prompts (at least 5, unlimited words) → Step 3: Review & submit.
 * Used to submit (create) and to edit (MINE-02). The draft survives failed requests (NFR-04).
 */
export function EvaluationForm({
  form,
  recipientName,
  isSelf = false,
  mode,
  initial,
  onConfirm,
  onDone,
  onCancel,
}: EvaluationFormProps) {
  const basePrompts = useMemo(() => effectiveCommentPrompts(form), [form]);
  const [extraPrompts, setExtraPrompts] = useState<FormCommentPrompt[]>(() => {
    const baseKeys = new Set(basePrompts.map((p) => p.key));
    return Object.keys(initial?.comments ?? {})
      .filter((k) => !baseKeys.has(k) && (initial?.comments[k] ?? "").trim().length > 0)
      .map((k, i) => ({
        key: k,
        label: `Additional comment ${String(basePrompts.length + i + 1)}`,
        is_required: false,
      }));
  });
  const prompts = useMemo(() => [...basePrompts, ...extraPrompts], [basePrompts, extraPrompts]);
  const schema = useMemo(() => buildDraftSchema(form), [form]);
  const [step, setStep] = useState<Step>("criteria");
  const [changeSummary, setChangeSummary] = useState("");
  const [pending, setPending] = useState(false);
  const { control, handleSubmit, getValues, setValue, setError, trigger, formState } =
    useForm<EvaluationDraft>({
      resolver: zodResolver(schema),
      defaultValues: normalizeInitialDraft(form, initial),
    });

  const watchedComments = useWatch({ control, name: "comments" });
  const me = useCurrentUser().data;
  const allCommentTexts = Object.values(watchedComments ?? {}).join("\n");
  const ownNames = isSelf ? [] : ownNameMentions(allCommentTexts, me);

  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const commentsHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (step === "review") reviewHeading.current?.focus();
    if (step === "comments") commentsHeading.current?.focus();
  }, [step]);

  async function goToComments() {
    const valid = await trigger("ratings");
    if (valid) {
      setStep("comments");
    }
  }

  const goToReview = handleSubmit(() => {
    setStep("review");
  });

  function addExtraCommentPrompt() {
    const nextNumber = prompts.length + 1;
    const key = `comment_${String(nextNumber)}`;
    setExtraPrompts((prev) => [
      ...prev,
      {
        key,
        label: `Additional comment (Dugang nga komento #${String(nextNumber)})`,
        is_required: false,
      },
    ]);
    setValue(`comments.${key}`, "");
  }

  function buildNormalizedDraft(): EvaluationDraft {
    const raw = getValues();
    const comments = { ...raw.comments };
    return {
      ratings: raw.ratings,
      comment: (comments.comment ?? raw.comment ?? "").trim(),
      suggestion: (comments.suggestion ?? raw.suggestion ?? "").trim(),
      comments: Object.fromEntries(
        Object.entries(comments).map(([k, v]) => [k, v.trim()]),
      ),
    };
  }

  async function confirm() {
    setPending(true);
    try {
      onDone(await onConfirm(buildNormalizedDraft(), changeSummary.trim()));
    } catch (error) {
      applyServerErrors(error, setError, ["ratings", "comment", "suggestion", "comments"]);
      if (isApiError(error) && Object.keys(error.fields).length > 0) {
        if (typeof error.fields.comment === "object" && Array.isArray(error.fields.comment)) {
          const msg = error.fields.comment[0];
          if (typeof msg === "string") {
            setError("comments.comment", { type: "server", message: msg });
          }
        }
        if (typeof error.fields.suggestion === "object" && Array.isArray(error.fields.suggestion)) {
          const msg = error.fields.suggestion[0];
          if (typeof msg === "string") {
            setError("comments.suggestion", { type: "server", message: msg });
          }
        }
        if ("ratings" in error.fields) {
          setStep("criteria");
        } else {
          setStep("comments");
        }
      }
    } finally {
      setPending(false);
    }
  }

  if (step === "review") {
    const values = buildNormalizedDraft();
    return (
      <Stack spacing={3}>
        <StepIndicator step="review" />
        <Typography variant="h5" component="h2" tabIndex={-1} ref={reviewHeading}>
          {mode === "create" ? "Review your evaluation of" : "Review your changes for"}{" "}
          {isSelf ? `yourself (${recipientName})` : recipientName}
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
            comment={values.comment}
            suggestion={values.suggestion}
            comments={prompts.map((p) => ({
              key: p.key,
              label: p.label,
              body: values.comments[p.key] ?? "",
            }))}
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
        {isSelf ? (
          <Alert severity="info">
            <strong>Public Self-Evaluation:</strong> Your self-evaluation ratings and comments will
            be visible publicly on your member profile so all choir members can see them.
          </Alert>
        ) : (
          <PrivacyNotice />
        )}
        {ownNames.length > 0 ? <OwnNameWarning names={ownNames} /> : null}
        <FormAlert message={formState.errors.root?.server?.message} />
        <Stack direction={{ xs: "column-reverse", sm: "row" }} spacing={2}>
          <Button
            onClick={() => {
              setStep("comments");
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

  if (step === "comments") {
    return (
      <Stack
        component="form"
        spacing={3}
        noValidate
        onSubmit={goToReview}
        aria-label={`${mode === "create" ? "Evaluate" : "Edit evaluation of"} ${recipientName}`}
      >
        <StepIndicator step="comments" />
        <div>
          <Typography variant="h6" component="h2" tabIndex={-1} ref={commentsHeading}>
            {isSelf
              ? `Self-Comments & Reflections (${recipientName})`
              : `Comments & Suggestions for ${recipientName}`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isSelf
              ? "Share your self-evaluation comments below (at least 5 comment prompts available). You can write as many words as you want, and all choir members will be able to see your self-comments."
              : "Share at least 5 comments/suggestions below. You can write as many words as you want for each prompt."}
          </Typography>
        </div>
        <FormAlert message={formState.errors.root?.server?.message} />
        {prompts.map((prompt, idx) => {
          const textValue = watchedComments?.[prompt.key] ?? "";
          const words = countWords(textValue);
          const numberedLabel = `${String(idx + 1)}. ${prompt.label}${prompt.is_required ? "" : " (optional)"}`;
          return (
            <Controller
              key={prompt.key}
              control={control}
              name={`comments.${prompt.key}`}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    field.onChange(e.target.value);
                    if (prompt.key === "comment") {
                      setValue("comment", e.target.value);
                    } else if (prompt.key === "suggestion") {
                      setValue("suggestion", e.target.value);
                    }
                  }}
                  label={numberedLabel}
                  multiline
                  minRows={3}
                  error={Boolean(fieldState.error)}
                  helperText={
                    fieldState.error?.message ??
                    `${String(words)} ${words === 1 ? "word" : "words"} · Write as many words as you want.`
                  }
                />
              )}
            />
          );
        })}
        <div>
          <Button variant="outlined" size="small" onClick={addExtraCommentPrompt}>
            + Add another comment
          </Button>
        </div>
        {ownNames.length > 0 ? <OwnNameWarning names={ownNames} /> : null}
        <Stack direction={{ xs: "column-reverse", sm: "row" }} spacing={2}>
          {onCancel ? <Button onClick={onCancel}>Cancel</Button> : null}
          <Button
            variant="outlined"
            onClick={() => {
              setStep("criteria");
            }}
          >
            Back to criteria
          </Button>
          <Button type="submit" variant="contained" size="large">
            Review
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
      onSubmit={(e) => {
        e.preventDefault();
        void goToComments();
      }}
      aria-label={`${mode === "create" ? "Evaluate" : "Edit evaluation of"} ${recipientName}`}
    >
      <StepIndicator step="criteria" />
      <div>
        <Typography variant="h6" component="h2">
          Criteria Ratings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Rate {recipientName} on each criterion using the scale below, then continue to comments.
        </Typography>
      </div>
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

      <Stack direction={{ xs: "column-reverse", sm: "row" }} spacing={2}>
        {onCancel ? <Button onClick={onCancel}>Cancel</Button> : null}
        <Button type="submit" variant="contained" size="large">
          Next: Comments
        </Button>
      </Stack>
    </Stack>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "criteria", label: "Step 1: Criteria Ratings" },
    { key: "comments", label: "Step 2: Comments" },
    { key: "review", label: "Step 3: Review & Submit" },
  ];
  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }} aria-label="Evaluation steps">
      {steps.map((s) => (
        <Chip
          key={s.key}
          label={s.label}
          color={s.key === step ? "primary" : "default"}
          variant={s.key === step ? "filled" : "outlined"}
          size="small"
        />
      ))}
    </Stack>
  );
}

function OwnNameWarning({ names }: { names: string[] }) {
  return (
    <Alert severity="warning" role="status">
      Your text mentions your own name ({names.join(", ")}). Your name is hidden from the member,
      but signing a comment tells them it&apos;s from you. Remove it if you want to stay anonymous.
    </Alert>
  );
}
