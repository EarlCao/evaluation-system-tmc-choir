import { zodResolver } from "@hookform/resolvers/zod";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link as RouterLink, useParams } from "react-router";

import { AuthCard } from "@/components/AuthCard";
import { FormAlert } from "@/components/form/FormAlert";
import { PasswordField } from "@/components/form/PasswordField";
import { applyServerErrors } from "@/lib/forms";

import { useConfirmPasswordReset } from "../queries";
import { confirmResetSchema, PASSWORD_MIN_LENGTH, type ConfirmResetInput } from "../schemas";

/** Opened from the emailed link /reset-password/:uid/:token. */
export function ResetPasswordPage() {
  const { uid = "", token = "" } = useParams();
  const confirm = useConfirmPasswordReset(uid, token);
  const [done, setDone] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm<ConfirmResetInput>({
    resolver: zodResolver(confirmResetSchema),
    defaultValues: { new_password: "", confirm_password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      setDone((await confirm.mutateAsync(values)).detail);
    } catch (error) {
      applyServerErrors(error, setError, ["new_password"]);
    }
  });

  return (
    <AuthCard title="Choose a new password">
      {done ? (
        <>
          <FormAlert severity="success" message={done} />
          <Button component={RouterLink} to="/login" variant="contained">
            Log in
          </Button>
        </>
      ) : (
        <Stack
          component="form"
          spacing={2}
          noValidate
          onSubmit={onSubmit}
          aria-label="Choose a new password"
        >
          <FormAlert message={formState.errors.root?.server?.message} />
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
          <Button type="submit" variant="contained" size="large" disabled={formState.isSubmitting}>
            Save new password
          </Button>
          <Link component={RouterLink} to="/forgot-password">
            Request a new link
          </Link>
        </Stack>
      )}
    </AuthCard>
  );
}
