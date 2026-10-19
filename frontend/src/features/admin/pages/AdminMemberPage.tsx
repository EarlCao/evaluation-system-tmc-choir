import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { Link as RouterLink, useParams } from "react-router";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorState } from "@/components/ErrorState";
import { FullPageSpinner } from "@/components/FullPageSpinner";
import { NotFoundPage } from "@/components/NotFoundPage";
import { isApiError } from "@/lib/errors";

import * as api from "../api";
import {
  useAdminMember,
  useAdminVoiceSections,
  useMemberAction,
  useSendPasswordReset,
} from "../queries";
import type { AdminMember, UserRole, UserStatus } from "../types";
import { StatusChip } from "./AdminMembersPage";

type Pending =
  | { kind: "status"; status: UserStatus; title: string; confirm: string; destructive: boolean }
  | { kind: "role"; role: UserRole }
  | { kind: "reset" }
  | null;

function errorText(error: unknown): string | undefined {
  return error ? (isApiError(error) ? error.message : "Something went wrong.") : undefined;
}

function ProfileForm({ member }: { member: AdminMember }) {
  const sections = useAdminVoiceSections();
  const update = useMemberAction(
    member.public_id,
    (changes: Parameters<typeof api.updateAdminProfile>[1]) =>
      api.updateAdminProfile(member.public_id, changes),
  );
  const profile = member.profile;
  const [section, setSection] = useState(String(profile?.voice_section.id ?? ""));
  const [evaluable, setEvaluable] = useState(profile?.is_evaluable ?? true);
  const [joined, setJoined] = useState(profile?.joined_choir_on ?? "");
  if (!profile) {
    return (
      <Typography color="text.secondary">
        This account has no choir profile (Super Admin).
      </Typography>
    );
  }
  return (
    <Stack
      component="form"
      spacing={2}
      aria-label="Choir profile"
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate({
          voice_section: Number(section),
          is_evaluable: evaluable,
          joined_choir_on: joined || null,
        });
      }}
    >
      {update.isSuccess ? <Alert severity="success">Profile saved.</Alert> : null}
      {update.isError ? <Alert severity="error">{errorText(update.error)}</Alert> : null}
      <TextField
        select
        label="Voice section"
        value={section}
        onChange={(e) => {
          setSection(e.target.value);
        }}
        sx={{ maxWidth: 280 }}
      >
        {(sections.data ?? [])
          .filter((s) => s.is_active || String(s.id) === section)
          .map((s) => (
            <MenuItem key={s.id} value={String(s.id)}>
              {s.name}
            </MenuItem>
          ))}
      </TextField>
      <FormControlLabel
        control={
          <Switch
            checked={evaluable}
            onChange={(e) => {
              setEvaluable(e.target.checked);
            }}
          />
        }
        label="Can be evaluated by other members"
      />
      <TextField
        label="Member of the choir since"
        type="date"
        value={joined}
        onChange={(e) => {
          setJoined(e.target.value);
        }}
        slotProps={{ inputLabel: { shrink: true } }}
        sx={{ maxWidth: 280 }}
      />
      <div>
        <Button type="submit" variant="contained" disabled={update.isPending}>
          Save profile
        </Button>
      </div>
    </Stack>
  );
}

/** AUTH-05 / ADM-04 / MEM-05: one account, its status, role and choir profile. */
export function AdminMemberPage() {
  const { publicId = "" } = useParams();
  const member = useAdminMember(publicId);
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const approve = useMemberAction(publicId, () => api.approveMember(publicId));
  const status = useMemberAction(publicId, (args: { status: UserStatus; reason: string }) =>
    api.setMemberStatus(publicId, args.status, args.reason),
  );
  const role = useMemberAction(publicId, (next: UserRole) => api.setMemberRole(publicId, next));
  const reset = useSendPasswordReset(publicId);

  if (member.isPending) return <FullPageSpinner label="Loading member" />;
  if (member.isError) {
    if (isApiError(member.error) && member.error.status === 404) return <NotFoundPage />;
    return (
      <ErrorState message="We couldn't load this account." onRetry={() => void member.refetch()} />
    );
  }
  const m = member.data;
  const actionError = errorText(approve.error ?? status.error ?? role.error ?? reset.error);
  const busy = approve.isPending || status.isPending || role.isPending || reset.isPending;

  function close() {
    setPending(null);
    setReason("");
  }

  async function confirm() {
    if (!pending) return;
    try {
      if (pending.kind === "status") {
        await status.mutateAsync({ status: pending.status, reason: reason.trim() });
        setNotice(`Status changed to ${pending.status.toLowerCase()}.`);
      } else if (pending.kind === "role") {
        await role.mutateAsync(pending.role);
        setNotice(
          pending.role === "SUPER_ADMIN" ? "Promoted to Super Admin." : "Changed to member.",
        );
      } else {
        await reset.mutateAsync();
        setNotice(`A password reset email was sent to ${m.email}.`);
      }
    } catch {
      setNotice(null);
    } finally {
      close();
    }
  }

  return (
    <Stack spacing={3} sx={{ py: 4, maxWidth: 860 }}>
      <Link component={RouterLink} to="/admin/members">
        ← Members
      </Link>
      <div>
        <Typography variant="h4" component="h1">
          {m.first_name} {m.last_name}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: "center", flexWrap: "wrap" }}>
          <StatusChip status={m.status} />
          <Chip size="small" label={m.role === "SUPER_ADMIN" ? "Super Admin" : "Member"} />
          <Typography variant="body2" color="text.secondary">
            {m.username} · {m.email}
            {m.email_verified ? " (verified)" : ""}
          </Typography>
        </Stack>
      </div>

      {notice ? (
        <Alert
          severity="success"
          role="status"
          onClose={() => {
            setNotice(null);
          }}
        >
          {notice}
        </Alert>
      ) : null}
      {actionError ? <Alert severity="error">{actionError}</Alert> : null}

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" component="h2" gutterBottom>
          Account
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Joined {new Date(m.date_joined).toLocaleDateString()}
          {m.approved_at ? ` · approved ${new Date(m.approved_at).toLocaleDateString()}` : ""}
          {m.last_login
            ? ` · last login ${new Date(m.last_login).toLocaleString()}`
            : " · never logged in"}
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ flexWrap: "wrap" }}>
          {m.status === "PENDING" ? (
            <Button
              variant="contained"
              disabled={busy}
              onClick={() => {
                void approve.mutateAsync().then(
                  () => {
                    setNotice("Account approved.");
                  },
                  () => undefined,
                );
              }}
            >
              Approve
            </Button>
          ) : null}
          {m.status === "ACTIVE" ? (
            <Button
              color="error"
              variant="outlined"
              disabled={busy}
              onClick={() => {
                setPending({
                  kind: "status",
                  status: "SUSPENDED",
                  title: "Suspend this account?",
                  confirm: "Suspend",
                  destructive: true,
                });
              }}
            >
              Suspend
            </Button>
          ) : null}
          {m.status === "SUSPENDED" || m.status === "DEACTIVATED" ? (
            <Button
              variant="outlined"
              disabled={busy}
              onClick={() => {
                setPending({
                  kind: "status",
                  status: "ACTIVE",
                  title: "Reactivate this account?",
                  confirm: "Reactivate",
                  destructive: false,
                });
              }}
            >
              Reactivate
            </Button>
          ) : null}
          {m.status !== "DEACTIVATED" ? (
            <Button
              color="error"
              disabled={busy}
              onClick={() => {
                setPending({
                  kind: "status",
                  status: "DEACTIVATED",
                  title: "Deactivate this account?",
                  confirm: "Deactivate",
                  destructive: true,
                });
              }}
            >
              Deactivate
            </Button>
          ) : null}
          {m.role === "SUPER_ADMIN" ? (
            <Button
              disabled={busy}
              onClick={() => {
                setPending({
                  kind: "role",
                  role: "MEMBER",
                });
              }}
            >
              Change to member
            </Button>
          ) : null}
          {m.status === "ACTIVE" && m.role !== "SUPER_ADMIN" ? (
            <Button
              disabled={busy}
              onClick={() => {
                setPending({ kind: "reset" });
              }}
            >
              Send password reset
            </Button>
          ) : null}
        </Stack>
      </Paper>

      {m.role !== "SUPER_ADMIN" ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" component="h2" gutterBottom>
            Choir profile
          </Typography>
          <ProfileForm key={m.public_id} member={m} />
        </Paper>
      ) : null}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        {m.role !== "SUPER_ADMIN" ? (
          <>
            <Button
              component={RouterLink}
              to={`/admin/evaluations?recipient=${m.public_id}`}
              variant="outlined"
            >
              Evaluations about them
            </Button>
            <Button
              component={RouterLink}
              to={`/admin/evaluations?evaluator=${m.public_id}`}
              variant="outlined"
            >
              Evaluations they wrote
            </Button>
            <Button
              component={RouterLink}
              to={`/admin/reports/members/${m.public_id}`}
              variant="outlined"
            >
              Report
            </Button>
          </>
        ) : null}
        <Button component={RouterLink} to={`/admin/audit?actor=${m.public_id}`} variant="outlined">
          Activity in the audit log
        </Button>
      </Stack>

      <ConfirmDialog
        open={pending !== null}
        pending={busy}
        title={
          pending?.kind === "status"
            ? pending.title
            : pending?.kind === "role"
              ? pending.role === "SUPER_ADMIN"
                ? "Make this member a Super Admin?"
                : "Remove Super Admin rights?"
              : "Send a password reset email?"
        }
        description={
          pending?.kind === "status"
            ? pending.status === "ACTIVE"
              ? "They will be able to log in and use the system again."
              : "They will be signed out everywhere and can no longer log in. Their evaluations are kept."
            : pending?.kind === "role"
              ? pending.role === "SUPER_ADMIN"
                ? "Super Admins can see who wrote every evaluation and change all settings. They no longer submit evaluations themselves."
                : "They will lose access to the admin area."
              : `A reset link will be emailed to ${m.email}.`
        }
        confirmLabel={
          pending?.kind === "status"
            ? pending.confirm
            : pending?.kind === "role"
              ? "Change role"
              : "Send email"
        }
        destructive={pending?.kind === "status" ? pending.destructive : pending?.kind === "role"}
        onClose={close}
        onConfirm={() => void confirm()}
      >
        {pending?.kind === "status" ? (
          <TextField
            label="Reason (kept in the audit log)"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
            }}
            fullWidth
            sx={{ mt: 2 }}
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
        ) : null}
      </ConfirmDialog>
    </Stack>
  );
}
