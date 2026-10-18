import { zodResolver } from "@hookform/resolvers/zod";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormAlert } from "@/components/form/FormAlert";
import { FormTextField } from "@/components/form/FormTextField";
import { PasswordField } from "@/components/form/PasswordField";
import { isApiError } from "@/lib/errors";
import { applyServerErrors } from "@/lib/forms";

import {
  useChangePassword,
  useCurrentUser,
  useDeactivateOwnAccount,
  useDownloadOwnData,
  useUpdateProfile,
} from "../queries";
import {
  changePasswordSchema,
  PASSWORD_MIN_LENGTH,
  profileSchema,
  type ChangePasswordInput,
  type ProfileInput,
} from "../schemas";
import type { CurrentUser } from "../types";

function ProfileForm({ user }: { user: CurrentUser }) {
  const update = useUpdateProfile();
  const [saved, setSaved] = useState(false);
  const { control, handleSubmit, setError, formState } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: user.first_name,
      last_name: user.last_name,
      display_name: user.display_name,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSaved(false);
    try {
      await update.mutateAsync(values);
      setSaved(true);
    } catch (error) {
      applyServerErrors(error, setError, ["first_name", "last_name", "display_name"]);
    }
  });

  return (
    <Stack component="form" spacing={2} noValidate onSubmit={onSubmit} aria-label="Your details">
      <FormAlert message={formState.errors.root?.server?.message} />
      <FormAlert severity="success" message={saved ? "Your details were saved." : undefined} />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <FormTextField
          name="first_name"
          control={control}
          label="First name"
          autoComplete="given-name"
        />
        <FormTextField
          name="last_name"
          control={control}
          label="Last name"
          autoComplete="family-name"
        />
      </Stack>
      <FormTextField
        name="display_name"
        control={control}
        label="Display name (optional)"
        autoComplete="nickname"
      />
      <Typography variant="body2" color="text.secondary">
        Username: {user.username} · Email: {user.email}
      </Typography>
      <div>
        <Button type="submit" variant="contained" disabled={formState.isSubmitting}>
          Save details
        </Button>
      </div>
    </Stack>
  );
}

function ChangePasswordForm() {
  const change = useChangePassword();
  const [changed, setChanged] = useState(false);
  const { control, handleSubmit, setError, reset, formState } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { old_password: "", new_password: "", confirm_password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setChanged(false);
    try {
      await change.mutateAsync(values);
      reset();
      setChanged(true);
    } catch (error) {
      applyServerErrors(error, setError, ["old_password", "new_password"]);
    }
  });

  return (
    <Stack component="form" spacing={2} noValidate onSubmit={onSubmit} aria-label="Change password">
      <FormAlert message={formState.errors.root?.server?.message} />
      <FormAlert
        severity="success"
        message={changed ? "Your password was changed. Other devices were signed out." : undefined}
      />
      <PasswordField
        name="old_password"
        control={control}
        label="Current password"
        autoComplete="current-password"
      />
      <PasswordField
        name="new_password"
        control={control}
        label="New password"
        autoComplete="new-password"
        helperText={`At least ${PASSWORD_MIN_LENGTH} characters, not entirely numeric.`}
      />
      <PasswordField
        name="confirm_password"
        control={control}
        label="Confirm new password"
        autoComplete="new-password"
      />
      <div>
        <Button type="submit" variant="outlined" disabled={formState.isSubmitting}>
          Change password
        </Button>
      </div>
    </Stack>
  );
}

function DataAndAccountSection() {
  const download = useDownloadOwnData();
  const deactivate = useDeactivateOwnAccount();
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function handleDownload() {
    setErrorMessage(undefined);
    try {
      const payload = await download.mutateAsync();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-data.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(isApiError(error) ? error.message : "Could not export your data.");
    }
  }

  async function handleDeactivate(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);
    try {
      await deactivate.mutateAsync({ password, reason });
    } catch (error) {
      if (isApiError(error)) {
        const fieldMsg = error.fields.password?.[0];
        setErrorMessage(fieldMsg ?? error.message);
      } else {
        setErrorMessage("Could not deactivate your account.");
      }
    }
  }

  return (
    <Stack spacing={2}>
      <FormAlert message={errorMessage} />
      <Typography variant="body2" color="text.secondary">
        Download a copy of your account profile, evaluations you submitted, and anonymised feedback
        you received.
      </Typography>
      <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", rowGap: 1 }}>
        <Button variant="outlined" onClick={handleDownload} disabled={download.isPending}>
          Download my data (JSON)
        </Button>
        <Button
          variant="outlined"
          color="error"
          onClick={() => setShowDeactivate((prev) => !prev)}
        >
          {showDeactivate ? "Cancel deactivation" : "Deactivate account"}
        </Button>
      </Stack>
      {showDeactivate && (
        <Stack
          component="form"
          spacing={2}
          noValidate
          onSubmit={handleDeactivate}
          aria-label="Deactivate account"
        >
          <Typography variant="body2" color="text.secondary">
            Deactivating signs you out and prevents future logins unless a Super Admin reactivates
            your account. Past evaluations remain intact (BR-06).
          </Typography>
          <TextField
            label="Confirm your password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            size="small"
          />
          <TextField
            label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            size="small"
          />
          <div>
            <Button
              type="submit"
              variant="contained"
              color="error"
              disabled={!password || deactivate.isPending}
            >
              Confirm account deactivation
            </Button>
          </div>
        </Stack>
      )}
    </Stack>
  );
}

/** AUTH-04: view and update permitted personal information; change password; data & deactivation. */
export function ProfilePage() {
  const { data: user } = useCurrentUser();
  if (!user) return null; // RequireAuth guarantees a user
  return (
    <Stack spacing={3} sx={{ py: 4, maxWidth: 720 }}>
      <Typography variant="h4" component="h1">
        Your profile
      </Typography>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" component="h2" gutterBottom>
          Your details
        </Typography>
        <ProfileForm user={user} />
      </Paper>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" component="h2" gutterBottom>
          Password
        </Typography>
        <ChangePasswordForm />
      </Paper>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" component="h2" gutterBottom>
          Your data & account
        </Typography>
        <DataAndAccountSection />
      </Paper>
    </Stack>
  );
}

