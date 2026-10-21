import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { Controller, useFieldArray, useForm as useHookForm } from "react-hook-form";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorState } from "@/components/ErrorState";
import { FormAlert } from "@/components/form/FormAlert";
import { FormTextField } from "@/components/form/FormTextField";
import { FullPageSpinner } from "@/components/FullPageSpinner";
import { NotFoundPage } from "@/components/NotFoundPage";
import { formatDateTime } from "@/lib/datetime";
import { isApiError } from "@/lib/errors";
import { applyServerErrors } from "@/lib/forms";

import {
  useCommentPrompts,
  useCreateForm,
  useCriteria,
  useForm,
  usePublishForm,
  useUpdateForm,
} from "../configQueries";
import { formSchema, type FormValues } from "../configSchemas";
import type { CommentPrompt, Criterion, FormCommentPrompt, FormVersion } from "../configTypes";

const fmt = (n: number) => String(Number(n.toFixed(2)));

const DEFAULT_FORM_COMMENT_PROMPTS: FormCommentPrompt[] = [
  {
    key: "comment",
    label: "Comments (Unsay imong ikaingon sa akoa?)",
    is_required: false,
  },
  {
    key: "suggestion",
    label: "Suggestions (Unsay imong ikasuggest sa akoa?)",
    is_required: false,
  },
  {
    key: "comment_3",
    label: "Strengths / Positive traits (Unsay maayo nga nakita nimo sa akoa?)",
    is_required: false,
  },
  {
    key: "comment_4",
    label: "Areas for growth (Unsay angay pa nakong palambuon?)",
    is_required: false,
  },
  {
    key: "comment_5",
    label: "Encouragement / Message (Unsay imong mensahe o pagdasig para sa akoa?)",
    is_required: false,
  },
];

function resolveInitialPrompts(
  base: FormVersion | undefined,
  globalPrompts: CommentPrompt[],
): FormCommentPrompt[] {
  if (base?.comment_prompts && base.comment_prompts.length > 0) {
    return base.comment_prompts;
  }
  if (base) {
    return [
      {
        key: "comment",
        label: "Comments (Unsay imong ikaingon sa akoa?)",
        is_required: base.comment_required,
      },
      {
        key: "suggestion",
        label: "Suggestions (Unsay imong ikasuggest sa akoa?)",
        is_required: base.suggestion_required,
      },
    ];
  }
  const activeGlobal = globalPrompts.filter((p) => p.is_active && !p.is_archived);
  if (activeGlobal.length > 0) {
    return activeGlobal.map((p) => ({
      key: p.key,
      label: p.label,
      is_required: p.is_required,
    }));
  }
  return DEFAULT_FORM_COMMENT_PROMPTS;
}

function PublishedView({ form }: { form: FormVersion }) {
  const prompts = resolveInitialPrompts(form, []);
  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Published {formatDateTime(form.published_at)}. Published forms can&apos;t change; copy it
        into a new draft instead.
      </Alert>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Step 1: Criteria Ratings
        </Typography>
        <Stack component="ol" spacing={1} sx={{ m: 0, pl: 3 }} aria-label="Criteria in this form">
          {form.items.map((item) => {
            const v = item.criterion_version;
            return (
              <li key={item.criterion_public_id}>
                <Typography sx={{ fontWeight: 600 }} component="span">
                  {v.name}
                </Typography>{" "}
                <Typography component="span" color="text.secondary">
                  v{v.version} · {fmt(v.min_value)}–{fmt(v.max_value)}, step {fmt(v.step)}
                  {v.is_required ? "" : " · optional"}
                </Typography>
              </li>
            );
          })}
        </Stack>
        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
          Step 2: Comment Prompts (unlimited words)
        </Typography>
        <Stack
          component="ol"
          spacing={0.5}
          sx={{ m: 0, pl: 3 }}
          aria-label="Comment prompts in this form"
        >
          {prompts.map((p) => (
            <li key={p.key}>
              <Typography component="span" sx={{ fontWeight: 600 }}>
                {p.label}
              </Typography>{" "}
              <Typography component="span" color="text.secondary">
                · {p.is_required ? "required" : "optional"} · unlimited words
              </Typography>
            </li>
          ))}
        </Stack>
      </Paper>
      <div>
        <Button
          component={RouterLink}
          to={`/admin/forms/new?from=${form.public_id}`}
          variant="outlined"
        >
          Copy into a new draft
        </Button>
      </div>
    </Stack>
  );
}

function DraftEditor({
  form,
  source,
  criteria,
  globalPrompts,
}: {
  form?: FormVersion;
  source?: FormVersion;
  criteria: Criterion[];
  globalPrompts: CommentPrompt[];
}) {
  const navigate = useNavigate();
  const create = useCreateForm();
  const update = useUpdateForm();
  const publish = usePublishForm();
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState(false);
  const base = form ?? source;
  const initialPrompts = resolveInitialPrompts(base, globalPrompts);
  const { control, handleSubmit, setError, reset, formState } = useHookForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: form?.title ?? (source ? `${source.title} (copy)` : ""),
      criteria: base?.items.map((i) => i.criterion_public_id) ?? [],
      comment_required: base?.comment_required ?? false,
      suggestion_required: base?.suggestion_required ?? false,
      comment_max_length: base?.comment_max_length ?? 100000,
      suggestion_max_length: base?.suggestion_max_length ?? 100000,
      comment_prompts: initialPrompts,
    },
  });
  const promptArray = useFieldArray({
    control,
    name: "comment_prompts",
  });
  const selectable = criteria.filter((c) => c.is_active && !c.is_archived);

  const onSubmit = handleSubmit(async (values) => {
    // Keep the criteria in the configured display order.
    const ordered = selectable.map((c) => c.public_id).filter((id) => values.criteria.includes(id));
    const cleanedPrompts = values.comment_prompts.map((p, idx) => ({
      key: p.key || `prompt_${String(idx + 1)}`,
      label: p.label.trim(),
      is_required: p.is_required,
    }));
    const commentReq = cleanedPrompts.find((p) => p.key === "comment")?.is_required ?? false;
    const suggestionReq = cleanedPrompts.find((p) => p.key === "suggestion")?.is_required ?? false;
    const input = {
      ...values,
      title: values.title.trim(),
      criteria: ordered,
      comment_required: commentReq,
      suggestion_required: suggestionReq,
      comment_prompts: cleanedPrompts,
    };
    setSaved(false);
    try {
      if (form) {
        await update.mutateAsync({ id: form.public_id, input });
        reset(input); // saved values become the new baseline, so Publish is enabled
        setSaved(true);
      } else {
        const created = await create.mutateAsync(input);
        void navigate(`/admin/forms/${created.public_id}`, { replace: true });
      }
    } catch (error) {
      applyServerErrors(error, setError, [
        "title",
        "criteria",
        "comment_max_length",
        "suggestion_max_length",
        "comment_prompts",
      ]);
    }
  });

  return (
    <Stack component="form" spacing={3} noValidate onSubmit={onSubmit} aria-label="Form editor">
      <FormAlert message={formState.errors.root?.server?.message} />
      {saved ? <Alert severity="success">Draft saved.</Alert> : null}
      {publish.isError ? (
        <Alert severity="error">
          {isApiError(publish.error) ? publish.error.message : "Couldn't publish."}
        </Alert>
      ) : null}
      <FormTextField name="title" control={control} label="Title" />
      <Paper variant="outlined" sx={{ p: 2 }} component="fieldset">
        <Typography component="legend" variant="subtitle1" sx={{ px: 1 }}>
          Step 1: Criteria (shown in the configured order)
        </Typography>
        <Controller
          control={control}
          name="criteria"
          render={({ field, fieldState }) => (
            <Stack>
              {selectable.map((c) => (
                <FormControlLabel
                  key={c.public_id}
                  label={`${c.current_version.name} (v${String(c.current_version.version)})`}
                  control={
                    <Checkbox
                      checked={field.value.includes(c.public_id)}
                      onChange={(e) => {
                        field.onChange(
                          e.target.checked
                            ? [...field.value, c.public_id]
                            : field.value.filter((id) => id !== c.public_id),
                        );
                      }}
                    />
                  }
                />
              ))}
              {selectable.length === 0 ? (
                <Typography color="text.secondary">Create criteria first.</Typography>
              ) : null}
              {fieldState.error ? (
                <FormHelperText error>{fieldState.error.message}</FormHelperText>
              ) : null}
            </Stack>
          )}
        />
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }} component="fieldset">
        <Typography component="legend" variant="subtitle1" sx={{ px: 1 }}>
          Step 2: Comment &amp; Suggestion Prompts (unlimited words)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Members will see these numbered prompts after rating criteria and can write as many words
          as they want.
        </Typography>
        <Stack spacing={2}>
          {promptArray.fields.map((item, idx) => (
            <Stack
              key={item.id}
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ alignItems: { sm: "center" } }}
            >
              <Typography sx={{ fontWeight: 600, minWidth: 28 }}>{idx + 1}.</Typography>
              <Controller
                control={control}
                name={`comment_prompts.${idx}.label`}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    size="small"
                    label={`Comment prompt ${String(idx + 1)}`}
                    placeholder="e.g. Comments (Unsay imong ikaingon sa akoa?)"
                    error={Boolean(fieldState.error)}
                    helperText={fieldState.error?.message}
                    sx={{ flex: 1 }}
                  />
                )}
              />
              <Controller
                control={control}
                name={`comment_prompts.${idx}.is_required`}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={field.value}
                        onChange={(e) => {
                          field.onChange(e.target.checked);
                        }}
                      />
                    }
                    label="Required"
                  />
                )}
              />
              <Stack direction="row" spacing={0.5}>
                <IconButton
                  size="small"
                  aria-label={`Move prompt ${String(idx + 1)} up`}
                  disabled={idx === 0}
                  onClick={() => {
                    promptArray.swap(idx, idx - 1);
                  }}
                >
                  ↑
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={`Move prompt ${String(idx + 1)} down`}
                  disabled={idx === promptArray.fields.length - 1}
                  onClick={() => {
                    promptArray.swap(idx, idx + 1);
                  }}
                >
                  ↓
                </IconButton>
                {promptArray.fields.length > 1 ? (
                  <Button
                    size="small"
                    color="error"
                    onClick={() => {
                      promptArray.remove(idx);
                    }}
                  >
                    Remove
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          ))}
          <div>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                promptArray.append({
                  key: `prompt_${String(promptArray.fields.length + 1)}_${String(Date.now()).slice(-4)}`,
                  label: "",
                  is_required: false,
                });
              }}
            >
              + Add comment prompt
            </Button>
          </div>
        </Stack>
      </Paper>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button type="submit" variant="contained" disabled={formState.isSubmitting}>
          {form ? "Save draft" : "Create draft"}
        </Button>
        {form ? (
          <Button
            variant="outlined"
            color="warning"
            onClick={() => {
              setConfirming(true);
            }}
            disabled={formState.isSubmitting || formState.isDirty}
          >
            Publish…
          </Button>
        ) : null}
      </Stack>
      {form && formState.isDirty ? (
        <Typography variant="body2" color="text.secondary">
          Save your changes before publishing.
        </Typography>
      ) : null}
      {form ? (
        <ConfirmDialog
          open={confirming}
          title="Publish this form?"
          description="Publishing freezes the form and the criterion versions it uses. Periods can then use it. You can't edit it afterwards."
          confirmLabel="Publish"
          pending={publish.isPending}
          onClose={() => {
            setConfirming(false);
          }}
          onConfirm={() => {
            publish.mutate(form.public_id, {
              onSettled: () => {
                setConfirming(false);
              },
            });
          }}
        />
      ) : null}
    </Stack>
  );
}

/** CFG-04 / CFG-06: create/edit a draft form, publish it, or view a published one. */
export function AdminFormEditorPage() {
  const { publicId = "" } = useParams();
  const [params] = useSearchParams();
  const sourceId = params.get("from") ?? "";
  const form = useForm(publicId);
  const source = useForm(sourceId);
  const criteria = useCriteria(false);
  const commentPrompts = useCommentPrompts(false);

  if (
    (publicId && form.isPending) ||
    (sourceId && source.isPending) ||
    criteria.isPending ||
    commentPrompts.isPending
  ) {
    return <FullPageSpinner label="Loading form" />;
  }
  if (form.isError) {
    if (isApiError(form.error) && form.error.status === 404) return <NotFoundPage />;
    return <ErrorState message="We couldn't load this form." onRetry={() => void form.refetch()} />;
  }
  if (criteria.isError)
    return (
      <ErrorState message="We couldn't load criteria." onRetry={() => void criteria.refetch()} />
    );

  const current = form.data;
  return (
    <Stack spacing={3} sx={{ py: 4, maxWidth: 860 }}>
      <Link component={RouterLink} to="/admin/forms">
        ← Forms
      </Link>
      <Typography variant="h4" component="h1">
        {current ? `${current.title} (v${String(current.version)})` : "New form"}
      </Typography>
      {current?.status === "PUBLISHED" ? (
        <PublishedView form={current} />
      ) : (
        <DraftEditor
          key={current?.public_id ?? "new"}
          form={current}
          source={source.data}
          criteria={criteria.data}
          globalPrompts={commentPrompts.data ?? []}
        />
      )}
    </Stack>
  );
}
