import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useBlocker } from "react-router";

import { FormAlert } from "@/components/form/FormAlert";
import { PrivacyNotice } from "@/components/PrivacyNotice";
import { useCurrentUser } from "@/features/auth";
import { isApiError } from "@/lib/errors";
import { applyServerErrors } from "@/lib/forms";
import { usePublicSettings } from "@/lib/systemSettings";

import { clearEvaluationDraft, saveEvaluationDraft } from "../draftStorage";
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
  recipientId?: string;
  cycleId?: string;
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
    ...initial.comments,
  };
  if (initial.comment && !comments.comment) {
    comments.comment = initial.comment;
  }
  if (initial.suggestion && !comments.suggestion) {
    comments.suggestion = initial.suggestion;
  }
  return {
    ratings: { ...base.ratings, ...initial.ratings },
    comment: comments.comment ?? initial.comment,
    suggestion: comments.suggestion ?? initial.suggestion,
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
  recipientId,
  cycleId,
  isSelf = false,
  mode,
  initial,
  onConfirm,
  onDone,
  onCancel,
}: EvaluationFormProps) {
  const publicSettings = usePublicSettings().data;
  const minCommentPrompts = publicSettings?.min_comment_prompts ?? 5;
  const basePrompts = useMemo(
    () => effectiveCommentPrompts(form, minCommentPrompts),
    [form, minCommentPrompts],
  );
  const baseKeys = useMemo(() => new Set(basePrompts.map((p) => p.key)), [basePrompts]);
  const [extraPrompts, setExtraPrompts] = useState<FormCommentPrompt[]>(() => {
    return Object.keys(initial?.comments ?? {})
      .filter((k) => !baseKeys.has(k) && (initial?.comments[k] ?? "").trim().length > 0)
      .map((k, i) => ({
        key: k,
        label: `Additional comment ${String(basePrompts.length + i + 1)}`,
        is_required: false,
      }));
  });
  const [promptToDelete, setPromptToDelete] = useState<FormCommentPrompt | null>(null);
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

  const watchedRatings = useWatch({ control, name: "ratings" });
  const watchedComments = useWatch({ control, name: "comments" });
  const me = useCurrentUser().data;
  const ownerId = me?.public_id ?? "";
  const allCommentTexts = Object.values(watchedComments).join("\n");
  const ownNames = isSelf ? [] : ownNameMentions(allCommentTexts, me);

  const hasRestoredDraft = useMemo(() => {
    if (mode !== "create" || !initial) return false;
    const hasRating = Object.values(initial.ratings).some((v) => v !== null);
    const hasComment = Object.values(initial.comments).some(
      (c) => typeof c === "string" && c.trim().length > 0,
    );
    return hasRating || hasComment;
  }, [mode, initial]);

  const hasProgress = useMemo(() => {
    const hasAnyRating = Object.values(watchedRatings).some((v) => v !== null);
    const hasAnyComment = Object.values(watchedComments).some(
      (c) => typeof c === "string" && c.trim().length > 0,
    );
    return hasAnyRating || hasAnyComment;
  }, [watchedRatings, watchedComments]);

  const submittedRef = useRef(false);

  useEffect(() => {
    if (mode !== "create" || !hasProgress || pending || submittedRef.current) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [mode, hasProgress, pending]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      mode === "create" &&
      hasProgress &&
      !pending &&
      !submittedRef.current &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  const handleSaveDraftAndLeave = () => {
    if (cycleId && recipientId) {
      saveEvaluationDraft(cycleId, recipientId, buildNormalizedDraft(), ownerId);
    }
    blocker.proceed?.();
  };

  const handleDiscardDraftAndLeave = () => {
    if (cycleId && recipientId) {
      clearEvaluationDraft(cycleId, recipientId, ownerId);
    }
    blocker.proceed?.();
  };

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
    const key = `comment_custom_${String(Date.now())}`;
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

  function confirmDeletePrompt() {
    if (!promptToDelete) return;
    const keyToRemove = promptToDelete.key;
    setExtraPrompts((prev) => prev.filter((p) => p.key !== keyToRemove));
    setValue(`comments.${keyToRemove}`, "");
    setPromptToDelete(null);
  }

  const buildNormalizedDraft = useCallback((): EvaluationDraft => {
    const raw = getValues();
    const activeKeys = new Set(prompts.map((p) => p.key));
    const comments: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw.comments)) {
      if (activeKeys.has(k)) {
        comments[k] = v.trim();
      }
    }
    return {
      ratings: raw.ratings,
      comment: (comments.comment ?? raw.comment).trim(),
      suggestion: (comments.suggestion ?? raw.suggestion).trim(),
      comments,
    };
  }, [getValues, prompts]);

  useEffect(() => {
    if (mode === "create" && cycleId && recipientId && hasProgress) {
      saveEvaluationDraft(cycleId, recipientId, buildNormalizedDraft(), ownerId);
    }
  }, [
    watchedRatings,
    watchedComments,
    mode,
    cycleId,
    recipientId,
    ownerId,
    hasProgress,
    buildNormalizedDraft,
  ]);

  async function confirm() {
    setPending(true);
    try {
      const result = await onConfirm(buildNormalizedDraft(), changeSummary.trim());
      submittedRef.current = true;
      if (cycleId && recipientId) {
        clearEvaluationDraft(cycleId, recipientId, ownerId);
      }
      onDone(result);
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
      <>
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
              <strong>Public Self-Evaluation:</strong> Your self-evaluation ratings and comments
              will be visible publicly on your member profile so all choir members can see them.
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
        <UnsavedChangesDialog
          blocker={blocker}
          recipientName={recipientName}
          onSaveAndLeave={handleSaveDraftAndLeave}
          onDiscardAndLeave={handleDiscardDraftAndLeave}
        />
      </>
    );
  }

  if (step === "comments") {
    return (
      <>
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
                ? `Share your self-evaluation comments below (at least ${String(minCommentPrompts)} comment prompts available). You can write as many words as you want, and all choir members will be able to see your self-comments.`
                : `Share at least ${String(minCommentPrompts)} comments/suggestions below. You can write as many words as you want for each prompt.`}
            </Typography>
          </div>
          <FormAlert message={formState.errors.root?.server?.message} />
          {prompts.map((prompt, idx) => {
            const isExtraPrompt = !baseKeys.has(prompt.key);
            const textValue = watchedComments[prompt.key] ?? "";
            const words = countWords(textValue);
            const numberedLabel = `${String(idx + 1)}. ${prompt.label}${prompt.is_required ? "" : " (optional)"}`;
            return (
              <Box key={prompt.key} sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                {isExtraPrompt ? (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 1,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      Additional comment #{String(idx + 1)}
                    </Typography>
                    <Button
                      type="button"
                      size="small"
                      color="error"
                      onClick={() => {
                        setPromptToDelete(prompt);
                      }}
                      startIcon={
                        <SvgIcon fontSize="small">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                        </SvgIcon>
                      }
                      sx={{ textTransform: "none", fontSize: "0.78rem" }}
                    >
                      Remove comment
                    </Button>
                  </Box>
                ) : null}
                <Typography
                  component="label"
                  htmlFor={`comment-field-${prompt.key}`}
                  sx={{
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    color: "text.primary",
                    display: "block",
                  }}
                >
                  {numberedLabel}
                </Typography>
                <Controller
                  control={control}
                  name={`comments.${prompt.key}`}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      id={`comment-field-${prompt.key}`}
                      value={field.value}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        if (prompt.key === "comment") {
                          setValue("comment", e.target.value);
                        } else if (prompt.key === "suggestion") {
                          setValue("suggestion", e.target.value);
                        }
                      }}
                      placeholder="Write your comments or suggestions here..."
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
              </Box>
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

        <Dialog
          open={promptToDelete !== null}
          onClose={() => {
            setPromptToDelete(null);
          }}
          aria-labelledby="remove-comment-dialog-title"
          aria-describedby="remove-comment-dialog-description"
        >
          <DialogTitle id="remove-comment-dialog-title">Remove Comment</DialogTitle>
          <DialogContent>
            <DialogContentText id="remove-comment-dialog-description">
              Are you sure you want to remove &ldquo;{promptToDelete?.label}&rdquo;? Any comments
              written in this field will be permanently deleted.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setPromptToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button color="error" variant="contained" onClick={confirmDeletePrompt} autoFocus>
              Remove
            </Button>
          </DialogActions>
        </Dialog>
        <UnsavedChangesDialog
          blocker={blocker}
          recipientName={recipientName}
          onSaveAndLeave={handleSaveDraftAndLeave}
          onDiscardAndLeave={handleDiscardDraftAndLeave}
        />
      </>
    );
  }

  return (
    <>
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
        {hasRestoredDraft ? (
          <Alert severity="info" sx={{ py: 0.5, px: 1.5, fontSize: "0.85rem" }}>
            Draft restored: Your previously saved ratings and comments have been loaded.
          </Alert>
        ) : null}
        <RatingScaleGuide />
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
          {onCancel ? (
            <Button onClick={onCancel} variant="outlined">
              {mode === "create" ? "Back to members" : "Cancel"}
            </Button>
          ) : null}
          <Button type="submit" variant="contained" size="large">
            Next: Comments
          </Button>
        </Stack>
      </Stack>
      <UnsavedChangesDialog
        blocker={blocker}
        recipientName={recipientName}
        onSaveAndLeave={handleSaveDraftAndLeave}
        onDiscardAndLeave={handleDiscardDraftAndLeave}
      />
    </>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "criteria", label: "Step 1: Criteria Ratings" },
    { key: "comments", label: "Step 2: Comments" },
    { key: "review", label: "Step 3: Review & Submit" },
  ];
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ flexWrap: "wrap", gap: 1 }}
      aria-label="Evaluation steps"
    >
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

const RATING_SCALE_EXPLANATIONS = [
  {
    score: 5,
    title: "5 — Excellent",
    short: "Outstanding",
    desc: "Exemplary consistency, outstanding musicality, punctuality, and positive leadership.",
    badgeBg: "rgba(212, 175, 55, 0.18)",
    badgeColor: "#d4af37",
  },
  {
    score: 4,
    title: "4 — Good",
    short: "Above Standard",
    desc: "Frequently exceeds expectations, strong preparation, reliable readiness, and active contribution.",
    badgeBg: "rgba(37, 99, 235, 0.15)",
    badgeColor: "#2563eb",
  },
  {
    score: 3,
    title: "3 — Satisfactory",
    short: "Meets Standard",
    desc: "Consistently meets standard choir expectations and fulfills vocal and rehearsal responsibilities.",
    badgeBg: "rgba(5, 150, 105, 0.15)",
    badgeColor: "#059669",
  },
  {
    score: 2,
    title: "2 — Developing",
    short: "Needs Practice",
    desc: "Shows effort and progress, but requires more rehearsal practice, vocal consistency, or attendance.",
    badgeBg: "rgba(217, 119, 6, 0.15)",
    badgeColor: "#d97706",
  },
  {
    score: 1,
    title: "1 — Needs Improvement",
    short: "Below Standard",
    desc: "Inconsistent performance or below standard; requires focused guidance and dedicated effort.",
    badgeBg: "rgba(220, 38, 38, 0.15)",
    badgeColor: "#dc2626",
  },
];

function RatingScaleGuide() {
  const [open, setOpen] = useState(true);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: 2,
        bgcolor: (theme) =>
          theme.palette.mode === "dark" ? "rgba(30, 41, 59, 0.45)" : "rgba(248, 250, 252, 0.9)",
        borderColor: "divider",
      }}
    >
      <Stack spacing={1.5}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            userSelect: "none",
          }}
          onClick={() => {
            setOpen((prev) => !prev);
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <SvgIcon fontSize="small" color="primary">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </SvgIcon>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: "0.02em" }}>
              Rating Scale Guide & Explanations
            </Typography>
          </Box>
          <Button
            size="small"
            sx={{ fontSize: "0.75rem", p: 0.5, minWidth: "auto", textTransform: "none" }}
            aria-expanded={open}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((prev) => !prev);
            }}
          >
            {open ? "Hide guide" : "Show guide"}
          </Button>
        </Box>
        {open ? (
          <>
            <Typography variant="body2" color="text.secondary">
              Use this standard 1 to 5 scale to evaluate fairly and constructively:
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(5, 1fr)" },
                gap: 1.25,
                pt: 0.5,
              }}
            >
              {RATING_SCALE_EXPLANATIONS.map((item) => (
                <Paper
                  key={item.score}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    bgcolor: "background.paper",
                    borderColor: "divider",
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.75,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                    }}
                  >
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: "0.8rem",
                        bgcolor: item.badgeBg,
                        color: item.badgeColor,
                        border: `1px solid ${item.badgeColor}40`,
                      }}
                    >
                      {item.score}
                    </Box>
                    <Chip
                      label={item.short}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        bgcolor: item.badgeBg,
                        color: item.badgeColor,
                      }}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "text.primary" }}>
                    {item.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ lineHeight: 1.35, fontSize: "0.72rem" }}
                  >
                    {item.desc}
                  </Typography>
                </Paper>
              ))}
            </Box>
          </>
        ) : null}
      </Stack>
    </Paper>
  );
}

interface UnsavedChangesDialogProps {
  blocker: {
    state: "unblocked" | "blocked" | "proceeding";
    reset?: () => void;
    proceed?: () => void;
  };
  recipientName: string;
  onSaveAndLeave: () => void;
  onDiscardAndLeave: () => void;
}

function UnsavedChangesDialog({
  blocker,
  recipientName,
  onSaveAndLeave,
  onDiscardAndLeave,
}: UnsavedChangesDialogProps) {
  const open = blocker.state === "blocked";

  return (
    <Dialog
      open={open}
      onClose={() => blocker.reset?.()}
      aria-labelledby="unsaved-changes-dialog-title"
      aria-describedby="unsaved-changes-dialog-description"
    >
      <DialogTitle id="unsaved-changes-dialog-title">Unsaved Evaluation Progress</DialogTitle>
      <DialogContent>
        <DialogContentText id="unsaved-changes-dialog-description">
          You have unsaved ratings or comments for <strong>{recipientName}</strong>. If you leave
          now, your progress will be saved as a draft so you won&apos;t need to rewrite your
          evaluation when you return.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: "wrap" }}>
        <Button onClick={() => blocker.reset?.()} color="inherit">
          Stay &amp; Continue
        </Button>
        <Button onClick={onDiscardAndLeave} color="error">
          Discard Draft
        </Button>
        <Button onClick={onSaveAndLeave} variant="contained" autoFocus>
          Save Draft &amp; Leave
        </Button>
      </DialogActions>
    </Dialog>
  );
}
