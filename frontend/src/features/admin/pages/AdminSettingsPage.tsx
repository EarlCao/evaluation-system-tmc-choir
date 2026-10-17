import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState, type ReactNode, type SyntheticEvent } from "react";
import { Link as RouterLink } from "react-router";

import { ErrorState } from "@/components/ErrorState";
import { FullPageSpinner } from "@/components/FullPageSpinner";
import { formatDateTime } from "@/lib/datetime";
import { flattenFieldErrors, isApiError } from "@/lib/errors";

import { useAdminSettings, useUpdateSettings } from "../systemQueries";
import {
  REGISTRATION_LABEL,
  type AdminSettings,
  type RegistrationMode,
  type SettingsInput,
} from "../systemTypes";

const PRIVACY_FLOOR = 3;
const RETENTION = [
  ["retention_evaluations_days", "Evaluations"],
  ["retention_revisions_days", "Evaluation history (revisions)"],
  ["retention_audit_days", "Audit log (at least 30 days)"],
] as const;

type Draft = Record<keyof SettingsInput, string>;

const TIME_ZONES: string[] = (() => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
})();

function toDraft(s: AdminSettings): Draft {
  const text = (v: number | null) => (v === null ? "" : String(v));
  return {
    system_name: s.system_name,
    choir_name: s.choir_name,
    choir_description: s.choir_description,
    time_zone: s.time_zone,
    registration_mode: s.registration_mode,
    min_aggregate_group_size: String(s.min_aggregate_group_size),
    feedback_notification_debounce_minutes: String(s.feedback_notification_debounce_minutes),
    privacy_notice: s.privacy_notice,
    retention_evaluations_days: text(s.retention_evaluations_days),
    retention_revisions_days: text(s.retention_revisions_days),
    retention_audit_days: text(s.retention_audit_days),
  };
}

/** Mirrors the server rules; the server stays authoritative. */
function validate(d: Draft): Record<string, string> {
  const errors: Record<string, string> = {};
  const whole = (v: string) => /^\d+$/.test(v);
  if (!d.system_name.trim()) errors.system_name = "Enter a name.";
  if (!d.privacy_notice.trim()) errors.privacy_notice = "The privacy notice can't be empty.";
  if (!whole(d.min_aggregate_group_size) || Number(d.min_aggregate_group_size) < PRIVACY_FLOOR)
    errors.min_aggregate_group_size = `At least ${String(PRIVACY_FLOOR)}, so nobody can work out who rated them.`;
  if (
    !whole(d.feedback_notification_debounce_minutes) ||
    Number(d.feedback_notification_debounce_minutes) > 1440
  )
    errors.feedback_notification_debounce_minutes = "Between 0 and 1440 minutes.";
  for (const [key] of RETENTION) {
    const value = d[key];
    if (value && (!whole(value) || Number(value) < 1))
      errors[key] = "Whole days, or empty to keep.";
  }
  if (d.retention_audit_days && Number(d.retention_audit_days) < 30)
    errors.retention_audit_days = "Keep the audit log for at least 30 days.";
  return errors;
}

function toInput(d: Draft): SettingsInput {
  const days = (v: string) => (v ? Number(v) : null);
  return {
    system_name: d.system_name.trim(),
    choir_name: d.choir_name.trim(),
    choir_description: d.choir_description,
    time_zone: d.time_zone,
    registration_mode: d.registration_mode as RegistrationMode,
    min_aggregate_group_size: Number(d.min_aggregate_group_size),
    feedback_notification_debounce_minutes: Number(d.feedback_notification_debounce_minutes),
    privacy_notice: d.privacy_notice,
    retention_evaluations_days: days(d.retention_evaluations_days),
    retention_revisions_days: days(d.retention_revisions_days),
    retention_audit_days: days(d.retention_audit_days),
  };
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        {children}
      </Stack>
    </Paper>
  );
}

function SettingsForm({ settings }: { settings: AdminSettings }) {
  const save = useUpdateSettings();
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const saved = toInput(toDraft(settings));
  const current = toInput(draft);
  const changes = Object.fromEntries(
    Object.entries(current).filter(([k, v]) => saved[k as keyof SettingsInput] !== v),
  ) as SettingsInput;
  const dirty = Object.keys(changes).length > 0;

  function set(key: keyof Draft, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    setNotice(null);
  }

  async function submit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    try {
      const result = await save.mutateAsync(changes);
      setDraft(toDraft(result));
      setNotice("Settings saved.");
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

  const props = (key: keyof Draft) => ({
    value: draft[key],
    onChange: (e: { target: { value: string } }) => {
      set(key, e.target.value);
    },
    error: Boolean(errors[key]),
    helperText: errors[key],
    fullWidth: true,
  });

  return (
    <Stack component="form" spacing={3} noValidate onSubmit={(e) => void submit(e)}>
      {notice ? <Alert severity="success">{notice}</Alert> : null}
      {serverError ? <Alert severity="error">{serverError}</Alert> : null}

      <Group title="General">
        <TextField label="System name" {...props("system_name")} />
        <TextField label="Choir name" {...props("choir_name")} />
        <TextField label="About the choir" multiline minRows={2} {...props("choir_description")} />
        <Autocomplete
          options={TIME_ZONES}
          value={draft.time_zone}
          disableClearable
          onChange={(_, value) => {
            set("time_zone", value);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Time zone"
              error={Boolean(errors.time_zone)}
              helperText={errors.time_zone ?? "Used for dates shown to members and in reports."}
            />
          )}
        />
      </Group>

      <Group title="Registration and privacy">
        <TextField select label="New accounts" {...props("registration_mode")}>
          {(Object.keys(REGISTRATION_LABEL) as RegistrationMode[]).map((mode) => (
            <MenuItem key={mode} value={mode}>
              {REGISTRATION_LABEL[mode]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Smallest group shown in averages"
          type="number"
          {...props("min_aggregate_group_size")}
          helperText={
            errors.min_aggregate_group_size ??
            `Averages based on fewer ratings are hidden from members and in choir reports. Minimum ${String(PRIVACY_FLOOR)}.`
          }
          slotProps={{ htmlInput: { min: PRIVACY_FLOOR } }}
        />
        <TextField
          label="Privacy notice"
          multiline
          minRows={4}
          {...props("privacy_notice")}
          helperText={
            errors.privacy_notice ??
            "Shown before every evaluation is submitted and on the public privacy page. Keep it accurate: the Super Admin can see who wrote each evaluation."
          }
        />
        <Link component={RouterLink} to="/privacy" target="_blank" rel="noopener">
          Open the privacy page
        </Link>
      </Group>

      <Group title="Notifications">
        <TextField
          label="Wait before telling a member about new feedback (minutes)"
          type="number"
          {...props("feedback_notification_debounce_minutes")}
          helperText={
            errors.feedback_notification_debounce_minutes ??
            "Several evaluations in this window become one notification, so the time of a notification doesn't reveal who wrote it."
          }
        />
      </Group>

      <Group title="Data retention">
        <Typography variant="body2" color="text.secondary">
          How long records are kept, in days. Leave empty to keep them. Clean-up runs from Phase 6;
          until then nothing is deleted.
        </Typography>
        {RETENTION.map(([key, label]) => (
          <TextField key={key} label={label} type="number" {...props(key)} />
        ))}
      </Group>

      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Button type="submit" variant="contained" disabled={!dirty || save.isPending}>
          Save settings
        </Button>
        <Button
          disabled={!dirty || save.isPending}
          onClick={() => {
            setDraft(toDraft(settings));
            setErrors({});
          }}
        >
          Discard changes
        </Button>
      </Stack>
    </Stack>
  );
}

/** SET-01 / SET-03: system settings and the privacy notice. Every change is audited. */
export function AdminSettingsPage() {
  const settings = useAdminSettings();
  if (settings.isPending) return <FullPageSpinner label="Loading settings" />;
  if (settings.isError)
    return (
      <ErrorState
        message="We couldn't load the settings."
        onRetry={() => void settings.refetch()}
      />
    );
  return (
    <Stack spacing={3} sx={{ py: 4, maxWidth: 860 }}>
      <Typography variant="h4" component="h1">
        System settings
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Last changed {formatDateTime(settings.data.updated_at)}
        {settings.data.updated_by ? ` by ${settings.data.updated_by}` : ""}. Every change is
        recorded in the audit log.
      </Typography>
      <SettingsForm settings={settings.data} />
    </Stack>
  );
}
