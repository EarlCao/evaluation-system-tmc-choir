import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";

import { FormAlert } from "@/components/form/FormAlert";
import { FormTextField } from "@/components/form/FormTextField";
import { applyServerErrors } from "@/lib/forms";

import {
  useCategories,
  useCreateCriterion,
  useCriterionVersions,
  useUpdateCriterion,
} from "../configQueries";
import { criterionSchema, labelledPoints, type CriterionFormValues } from "../configSchemas";
import type { Criterion, CriterionInput } from "../configTypes";

const pointKey = (n: number) => String(Number(n.toFixed(2)));

/** Label keys appear when the scale changes, so a lookup can be missing at runtime. */
const textValue = (value: string | undefined): string => value ?? "";

function defaults(criterion?: Criterion): CriterionFormValues {
  const v = criterion?.current_version;
  const scale = { min_value: v?.min_value ?? 1, max_value: v?.max_value ?? 5, step: v?.step ?? 1 };
  return {
    name: v?.name ?? "",
    description: v?.description ?? "",
    category: criterion?.category ? String(criterion.category.id) : "",
    scale_type: v?.scale_type ?? "NUMERIC",
    min_value: v?.min_value ?? 1,
    max_value: v?.max_value ?? 5,
    step: v?.step ?? 1,
    labels: labelledPoints(scale).map((p) => v?.labels[pointKey(p)] ?? ""),
    is_required: v?.is_required ?? true,
  };
}

function NumberField({
  name,
  label,
  control,
}: {
  name: "min_value" | "max_value" | "step";
  label: string;
  control: Control<CriterionFormValues>;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          label={label}
          type="number"
          value={Number.isFinite(field.value) ? field.value : ""}
          onChange={(e) => {
            field.onChange(e.target.value === "" ? Number.NaN : Number(e.target.value));
          }}
          onBlur={field.onBlur}
          error={Boolean(fieldState.error)}
          helperText={fieldState.error?.message}
          slotProps={{ htmlInput: { step: "any" } }}
          sx={{ flex: 1 }}
        />
      )}
    />
  );
}

function VersionHistory({ criterion }: { criterion: Criterion }) {
  const versions = useCriterionVersions(criterion.public_id, true);
  if (!versions.data || versions.data.length < 2) return null;
  return (
    <details>
      <summary>Version history ({versions.data.length} versions)</summary>
      <Stack component="ul" spacing={0.5} sx={{ pl: 2 }}>
        {versions.data.map((v) => (
          <Typography component="li" variant="body2" key={v.id}>
            v{v.version} · {v.name} · {pointKey(v.min_value)}–{pointKey(v.max_value)} (step{" "}
            {pointKey(v.step)}) · {new Date(v.created_at).toLocaleDateString()}
          </Typography>
        ))}
      </Stack>
    </details>
  );
}

interface CriterionDialogProps {
  open: boolean;
  criterion?: Criterion;
  onClose: (saved: boolean) => void;
}

/** EVAL-02..04 / CFG-01..03: create a criterion or change it (wording/scale → new version). */
export function CriterionDialog({ open, criterion, onClose }: CriterionDialogProps) {
  const categories = useCategories();
  const create = useCreateCriterion();
  const update = useUpdateCriterion();
  const { control, handleSubmit, setError, formState } = useForm<CriterionFormValues>({
    resolver: zodResolver(criterionSchema),
    defaultValues: defaults(criterion),
  });
  const [min, max, step, scaleType] = useWatch({
    control,
    name: ["min_value", "max_value", "step", "scale_type"],
  });
  const points = labelledPoints({ min_value: min, max_value: max, step });

  const onSubmit = handleSubmit(async (values) => {
    const labels = Object.fromEntries(
      points
        .map((p, i) => [pointKey(p), (values.labels[i] ?? "").trim()] as const)
        .filter(([, text]) => text),
    );
    const input: CriterionInput = {
      name: values.name.trim(),
      description: values.description.trim(),
      category: values.category ? Number(values.category) : null,
      scale_type: values.scale_type,
      min_value: values.min_value,
      max_value: values.max_value,
      step: values.step,
      labels,
      is_required: values.is_required,
    };
    try {
      if (criterion) await update.mutateAsync({ id: criterion.public_id, changes: input });
      else await create.mutateAsync(input);
      onClose(true);
    } catch (error) {
      applyServerErrors(error, setError, [
        "name",
        "description",
        "category",
        "scale_type",
        "min_value",
        "max_value",
        "step",
        "labels",
        "is_required",
      ]);
    }
  });

  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose(false);
      }}
      fullWidth
      maxWidth="sm"
      aria-labelledby="criterion-title"
    >
      <form noValidate onSubmit={onSubmit}>
        <DialogTitle id="criterion-title">
          {criterion ? "Edit criterion" : "New criterion"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {criterion ? (
              <Alert severity="info">
                Changing the wording or the scale creates version{" "}
                {criterion.current_version.version + 1}. Published forms and past evaluations keep
                the version they used.
              </Alert>
            ) : null}
            <FormAlert message={formState.errors.root?.server?.message} />
            <FormTextField name="name" control={control} label="Name" />
            <FormTextField
              name="description"
              control={control}
              label="Description (optional)"
              multiline
              minRows={2}
            />
            <FormTextField name="category" control={control} label="Category" select>
              <MenuItem value="">No category</MenuItem>
              {(categories.data ?? []).map((c) => (
                <MenuItem key={c.id} value={String(c.id)}>
                  {c.name}
                </MenuItem>
              ))}
            </FormTextField>
            <FormTextField name="scale_type" control={control} label="Scale type" select>
              <MenuItem value="NUMERIC">Points (e.g. 1–5)</MenuItem>
              <MenuItem value="PERCENT">Percentage (0–100)</MenuItem>
            </FormTextField>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <NumberField name="min_value" label="Minimum" control={control} />
              <NumberField
                name="max_value"
                label={scaleType === "PERCENT" ? "Maximum (≤ 100)" : "Maximum"}
                control={control}
              />
              <NumberField name="step" label="Step" control={control} />
            </Stack>
            {points.length > 0 ? (
              <Stack spacing={1}>
                <Typography variant="subtitle2" component="h3">
                  Labels (optional, e.g. 1 = Needs improvement)
                </Typography>
                {points.map((p, i) => (
                  <Controller
                    key={pointKey(p)}
                    control={control}
                    name={`labels.${i}`}
                    render={({ field, fieldState }) => (
                      <TextField
                        size="small"
                        label={`Label for ${pointKey(p)}`}
                        value={textValue(field.value)}
                        onChange={field.onChange}
                        error={Boolean(fieldState.error)}
                        helperText={fieldState.error?.message}
                        slotProps={{ htmlInput: { maxLength: 60 } }}
                      />
                    )}
                  />
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Labels can be added to scales with up to 11 points.
              </Typography>
            )}
            {formState.errors.labels?.message ? (
              <Typography variant="body2" color="error" role="alert">
                {formState.errors.labels.message}
              </Typography>
            ) : null}
            <Controller
              control={control}
              name="is_required"
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
                  label="Members must rate this criterion"
                />
              )}
            />
            {criterion ? <VersionHistory criterion={criterion} /> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              onClose(false);
            }}
            disabled={formState.isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={formState.isSubmitting}>
            {criterion ? "Save changes" : "Create criterion"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
