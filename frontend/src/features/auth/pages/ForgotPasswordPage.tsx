import { zodResolver } from "@hookform/resolvers/zod";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link as RouterLink } from "react-router";

import { AuthCard } from "@/components/AuthCard";
import { FormAlert } from "@/components/form/FormAlert";
import { FormTextField } from "@/components/form/FormTextField";
import { applyServerErrors } from "@/lib/forms";

import { useRequestPasswordReset } from "../queries";
import { forgotPasswordSchema, type ForgotPasswordInput } from "../schemas";

/** The server answers the same whether or not the email exists (no account enumeration). */
export function ForgotPasswordPage() {
  const requestReset = useRequestPasswordReset();
  const [sent, setSent] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    try {
      setSent((await requestReset.mutateAsync(email)).detail);
    } catch (error) {
      applyServerErrors(error, setError, ["email"]);
    }
  });

  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a link to choose a new one."
    >
      {sent ? (
        <FormAlert severity="success" message={sent} />
      ) : (
        <Stack
          component="form"
          spacing={2}
          noValidate
          onSubmit={onSubmit}
          aria-label="Reset password"
        >
          <FormAlert message={formState.errors.root?.server?.message} />
          <FormTextField
            name="email"
            control={control}
            label="Email"
            type="email"
            autoComplete="email"
          />
          <Button type="submit" variant="contained" size="large" disabled={formState.isSubmitting}>
            Send reset link
          </Button>
        </Stack>
      )}
      <Link component={RouterLink} to="/login">
        Back to log in
      </Link>
    </AuthCard>
  );
}
