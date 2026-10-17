import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState, type SyntheticEvent } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorState } from "@/components/ErrorState";
import { FullPageSpinner } from "@/components/FullPageSpinner";
import { NotFoundPage } from "@/components/NotFoundPage";
import { formatDateTime, fromLocalInput, toLocalInput } from "@/lib/datetime";
import { flattenFieldErrors, isApiError } from "@/lib/errors";

import {
  useCreateCycle,
  useCycle,
  useForms,
  useTransitionCycle,
  useUpdateCycle,
} from "../configQueries";
import { CYCLE_EDITABLE, type AdminCycle, type CycleInput, type CycleStatus } from "../configTypes";
import { CycleStatusChip } from "./AdminCyclesPage";

interface Draft {
  name: string;
  description: string;
  starts_at: string;
  ends_at: string;
  edit_deadline: string;
  form_version: string;
  allow_resubmission: boolean;
  evaluation_scope: AdminCycle["evaluation_scope"];
  feedback_visibility: AdminCycle["feedback_visibility"];
}

function toDraft(c?: AdminCycle): Draft {
  return {
    name: c?.name ?? "",
    description: c?.description ?? "",
    starts_at: toLocalInput(c?.starts_at),
    ends_at: toLocalInput(c?.ends_at),
    edit_deadline: toLocalInput(c?.edit_deadline),
    form_version: c?.form_version?.public_id ?? "",
    allow_resubmission: c?.allow_resubmission ?? false,
    evaluation_scope: c?.evaluation_scope ?? "ALL",
    feedback_visibility: c?.feedback_visibility ?? "IMMEDIATE",
  };
}

function toInput(d: Draft): Required<CycleInput> {
  return {
    name: d.name.trim(),
    description: d.description.trim(),
    starts_at: d.starts_at ? fromLocalInput(d.starts_at) : "",
    ends_at: d.ends_at ? fromLocalInput(d.ends_at) : "",
    edit_deadline: d.edit_deadline ? fromLocalInput(d.edit_deadline) : null,
    form_version: d.form_version || null,
    allow_resubmission: d.allow_resubmission,
    evaluation_scope: d.evaluation_scope,
    feedback_visibility: d.feedback_visibility,
  };
}

/** Client checks mirroring the server (which stays authoritative). */
function validate(d: Draft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!d.name.trim()) errors.name = "Enter a name.";
  if (!d.starts_at) errors.starts_at = "Choose a start.";
  if (!d.ends_at) errors.ends_at = "Choose an end.";
  if (d.starts_at && d.ends_at && d.ends_at <= d.starts_at)
    errors.ends_at = "The end must be after the start.";
  if (d.edit_deadline && d.starts_at && d.edit_deadline < d.starts_at) {
    errors.edit_deadline = "The edit deadline cannot be before the start.";
  }
  return errors;
}

const TRANSITIONS: Partial<
  Record<
    CycleStatus,
    { action: "open" | "close" | "archive"; label: string; title: string; text: string }
  >
> = {
  DRAFT: {
    action: "open",
    label: "Open period",
    title: "Open this period?",
    text: "Members can start submitting evaluations. Only one period can be open at a time, and the form, start date, scope and visibility are locked.",
  },
  OPEN: {
    action: "close",
    label: "Close period",
    title: "Close this period?",
    text: "Members can no longer submit or edit evaluations. Feedback set to appear after closing becomes visible to members.",
  },
  CLOSED: {
    action: "archive",
    label: "Archive period",
    title: "Archive this period?",
    text: "It stays in reports and history but is moved out of the way.",
  },
};

function CycleEditor({ cycle }: { cycle?: AdminCycle }) {
  const navigate = useNavigate();
  const forms = useForms();
  const create = useCreateCycle();
  const update = useUpdateCycle();
  const transition = useTransitionCycle();
  const [draft, setDraft] = useState<Draft>(toDraft(cycle));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const status: CycleStatus = cycle?.status ?? "DRAFT";
  const editable = CYCLE_EDITABLE[status];
  const can = (field: keyof CycleInput) => editable.has(field);
  const step = cycle ? TRANSITIONS[status] : undefined;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    setServerError(null);
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const input = toInput(draft);
    try {
      if (cycle) {
        const original = toInput(toDraft(cycle));
        const changes: CycleInput = {};
        for (const key of Object.keys(input) as (keyof CycleInput)[]) {
          if (can(key) && input[key] !== original[key])
            Object.assign(changes, { [key]: input[key] });
        }
        await update.mutateAsync({ id: cycle.public_id, input: changes });
        setNotice("Period saved.");
      } else {
        const created = await create.mutateAsync(input);
        void navigate(`/admin/cycles/${created.public_id}`, { replace: true });
      }
    } catch (error) {
      if (isApiError(error)) {
        const flat = flattenFieldErrors(error.fields);
        setErrors(flat);
        setServerError(Object.keys(flat).length > 0 ? null : error.message);
      } else {
        setServerError("Something went wrong.");
      }
    }
  }

  const field = (key: keyof Draft & keyof CycleInput) => ({
    disabled: Boolean(cycle) && !can(key),
    error: Boolean(errors[key]),
    helperText: errors[key],
  });

  return (
    <Stack spacing={3}>
      {notice ? (
        <Alert
          severity="success"
          onClose={() => {
            setNotice(null);
          }}
        >
          {notice}
        </Alert>
      ) : null}
      {serverError ? <Alert severity="error">{serverError}</Alert> : null}
      {transition.isError ? (
        <Alert severity="error">
          {isApiError(transition.error) ? transition.error.message : "Something went wrong."}
        </Alert>
      ) : null}
      {cycle && status !== "DRAFT" ? (
        <Alert severity="info">
          Some settings are locked while the period is {status.toLowerCase()}.
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack
          component="form"
          spacing={2}
          noValidate
          onSubmit={(e) => void save(e)}
          aria-label="Period settings"
        >
          <TextField
            label="Name"
            value={draft.name}
            onChange={(e) => {
              set("name", e.target.value);
            }}
            {...field("name")}
          />
          <TextField
            label="Description (optional)"
            multiline
            minRows={2}
            value={draft.description}
            onChange={(e) => {
              set("description", e.target.value);
            }}
            {...field("description")}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Starts"
              type="datetime-local"
              value={draft.starts_at}
              onChange={(e) => {
                set("starts_at", e.target.value);
              }}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ flex: 1 }}
              {...field("starts_at")}
            />
            <TextField
              label="Ends"
              type="datetime-local"
              value={draft.ends_at}
              onChange={(e) => {
                set("ends_at", e.target.value);
              }}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ flex: 1 }}
              {...field("ends_at")}
            />
            <TextField
              label="Edits allowed until"
              type="datetime-local"
              value={draft.edit_deadline}
              onChange={(e) => {
                set("edit_deadline", e.target.value);
              }}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ flex: 1 }}
              {...field("edit_deadline")}
              helperText={errors.edit_deadline ?? "Empty = the end"}
            />
          </Stack>
          <TextField
            select
            label="Form"
            value={draft.form_version}
            onChange={(e) => {
              set("form_version", e.target.value);
            }}
            {...field("form_version")}
            helperText={errors.form_version ?? "Only published forms can be used."}
          >
            <MenuItem value="">No form yet</MenuItem>
            {(forms.data ?? [])
              .filter((f) => f.status === "PUBLISHED")
              .map((f) => (
                <MenuItem key={f.public_id} value={f.public_id}>
                  v{f.version} {f.title}
                </MenuItem>
              ))}
          </TextField>
          <TextField
            select
            label="Who evaluates whom"
            value={draft.evaluation_scope}
            onChange={(e) => {
              set("evaluation_scope", e.target.value as Draft["evaluation_scope"]);
            }}
            {...field("evaluation_scope")}
          >
            <MenuItem value="ALL">Everyone evaluates everyone</MenuItem>
            <MenuItem value="SAME_SECTION">Only members of the same voice section</MenuItem>
          </TextField>
          <TextField
            select
            label="Members see their feedback"
            value={draft.feedback_visibility}
            onChange={(e) => {
              set("feedback_visibility", e.target.value as Draft["feedback_visibility"]);
            }}
            {...field("feedback_visibility")}
          >
            <MenuItem value="IMMEDIATE">As soon as it is submitted</MenuItem>
            <MenuItem value="AFTER_CLOSE">
              When the period closes (harder to guess who wrote what)
            </MenuItem>
          </TextField>
          <FormControlLabel
            control={
              <Switch
                checked={draft.allow_resubmission}
                disabled={Boolean(cycle) && !can("allow_resubmission")}
                onChange={(e) => {
                  set("allow_resubmission", e.target.checked);
                }}
              />
            }
            label="Allow more than one evaluation of the same member in this period"
          />
          <div>
            <Button
              type="submit"
              variant="contained"
              disabled={create.isPending || update.isPending}
            >
              {cycle ? "Save period" : "Create period"}
            </Button>
          </div>
        </Stack>
      </Paper>

      {cycle ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" component="h2" gutterBottom>
            Status
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Opened {formatDateTime(cycle.opened_at)} · closed {formatDateTime(cycle.closed_at)}
          </Typography>
          {step ? (
            <Button
              variant="outlined"
              color={step.action === "open" ? "primary" : "warning"}
              onClick={() => {
                setConfirming(true);
              }}
            >
              {step.label}
            </Button>
          ) : (
            <Typography color="text.secondary">Archived periods have no further steps.</Typography>
          )}
          {step ? (
            <ConfirmDialog
              open={confirming}
              title={step.title}
              description={step.text}
              confirmLabel={step.label}
              pending={transition.isPending}
              onClose={() => {
                setConfirming(false);
              }}
              onConfirm={() => {
                transition.mutate(
                  { id: cycle.public_id, action: step.action },
                  {
                    onSuccess: (next) => {
                      setDraft(toDraft(next));
                      setNotice(`Period is now ${next.status.toLowerCase()}.`);
                    },
                    onSettled: () => {
                      setConfirming(false);
                    },
                  },
                );
              }}
            />
          ) : null}
        </Paper>
      ) : null}
    </Stack>
  );
}

/** EVAL-06 / CFG-05: create or manage one evaluation period. */
export function AdminCyclePage() {
  const { publicId = "" } = useParams();
  const isNew = publicId === "";
  const cycle = useCycle(publicId);
  if (!isNew && cycle.isPending) return <FullPageSpinner label="Loading period" />;
  if (!isNew && cycle.isError) {
    if (isApiError(cycle.error) && cycle.error.status === 404) return <NotFoundPage />;
    return (
      <ErrorState message="We couldn't load this period." onRetry={() => void cycle.refetch()} />
    );
  }
  const data = isNew ? undefined : cycle.data;
  return (
    <Stack spacing={3} sx={{ py: 4, maxWidth: 860 }}>
      <Link component={RouterLink} to="/admin/cycles">
        ← Periods
      </Link>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Typography variant="h4" component="h1">
          {data ? data.name : "New period"}
        </Typography>
        {data ? <CycleStatusChip status={data.status} /> : null}
      </Stack>
      <CycleEditor key={data ? `${data.public_id}-${data.status}` : "new"} cycle={data} />
    </Stack>
  );
}
