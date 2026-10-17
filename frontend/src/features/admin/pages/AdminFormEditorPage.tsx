import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { Controller, useForm as useHookForm } from "react-hook-form";
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
  useCreateForm,
  useCriteria,
  useForm,
  usePublishForm,
  useUpdateForm,
} from "../configQueries";
import { formSchema, type FormValues } from "../configSchemas";
import type { Criterion, FormVersion } from "../configTypes";

const fmt = (n: number) => String(Number(n.toFixed(2)));

function PublishedView({ form }: { form: FormVersion }) {
  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Published {formatDateTime(form.published_at)}. Published forms can't change; copy it into a
        new draft instead.
      </Alert>
      <Paper variant="outlined" sx={{ p: 2 }}>
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
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Comment {form.comment_required ? "required" : "optional"} (≤ {form.comment_max_length}) ·
          Suggestion {form.suggestion_required ? "required" : "optional"} (≤{" "}
          {form.suggestion_max_length})
        </Typography>
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
}: {
  form?: FormVersion;
  source?: FormVersion;
  criteria: Criterion[];
}) {
  const navigate = useNavigate();
  const create = useCreateForm();
  const update = useUpdateForm();
  const publish = usePublishForm();
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState(false);
  const base = form ?? source;
  const { control, handleSubmit, setError, reset, formState } = useHookForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: form?.title ?? (source ? `${source.title} (copy)` : ""),
      criteria: base?.items.map((i) => i.criterion_public_id) ?? [],
      comment_required: base?.comment_required ?? false,
      suggestion_required: base?.suggestion_required ?? false,
      comment_max_length: base?.comment_max_length ?? 2000,
      suggestion_max_length: base?.suggestion_max_length ?? 2000,
    },
  });
  const selectable = criteria.filter((c) => c.is_active && !c.is_archived);

  const onSubmit = handleSubmit(async (values) => {
    // Keep the criteria in the configured display order.
    const ordered = selectable.map((c) => c.public_id).filter((id) => values.criteria.includes(id));
    const input = { ...values, title: values.title.trim(), criteria: ordered };
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
          Criteria (shown in the configured order)
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
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        {(["comment", "suggestion"] as const).map((kind) => (
          <Paper key={kind} variant="outlined" sx={{ p: 2, flex: 1 }}>
            <Stack spacing={1}>
              <Controller
                control={control}
                name={`${kind}_required`}
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
                    label={kind === "comment" ? "Comment required" : "Suggestion required"}
                  />
                )}
              />
              <Controller
                control={control}
                name={`${kind}_max_length`}
                render={({ field, fieldState }) => (
                  <TextField
                    type="number"
                    label={kind === "comment" ? "Comment length limit" : "Suggestion length limit"}
                    value={Number.isFinite(field.value) ? field.value : ""}
                    onChange={(e) => {
                      field.onChange(e.target.value === "" ? Number.NaN : Number(e.target.value));
                    }}
                    error={Boolean(fieldState.error)}
                    helperText={fieldState.error?.message ?? "Characters, 1–5000"}
                  />
                )}
              />
            </Stack>
          </Paper>
        ))}
      </Stack>
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

  if ((publicId && form.isPending) || (sourceId && source.isPending) || criteria.isPending) {
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
        />
      )}
    </Stack>
  );
}
