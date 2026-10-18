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
import { PasswordField } from "@/components/form/PasswordField";
import { applyServerErrors } from "@/lib/forms";

import { useConfirmPasswordResetWithOtp, useRequestPasswordReset } from "../queries";
import {
  PASSWORD_MIN_LENGTH,
  forgotPasswordSchema,
  resetPasswordWithOtpSchema,
  type ForgotPasswordInput,
  type ResetPasswordWithOtpInput,
} from "../schemas";

/** The server answers the same whether or not the email exists (no account enumeration). */
export function ForgotPasswordPage() {
  const requestReset = useRequestPasswordReset();
  const confirmResetOtp = useConfirmPasswordResetWithOtp();
  const [sent, setSent] = useState<string | null>(null);
  const [requestedEmail, setRequestedEmail] = useState("");
  const [resetDone, setResetDone] = useState<string | null>(null);

  const { control, handleSubmit, setError, formState } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const otpForm = useForm<ResetPasswordWithOtpInput>({
    resolver: zodResolver(resetPasswordWithOtpSchema),
    defaultValues: {
      otp: "",
      new_password: "",
      confirm_password: "",
    },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    try {
      const cleanEmail = email.trim();
      setRequestedEmail(cleanEmail);
      setSent((await requestReset.mutateAsync(cleanEmail)).detail);
    } catch (error) {
      applyServerErrors(error, setError, ["email"]);
    }
  });

  const onConfirmOtp = otpForm.handleSubmit(async ({ otp, new_password }) => {
    try {
      const res = await confirmResetOtp.mutateAsync({
        email: requestedEmail,
        otp,
        new_password,
      });
      setResetDone(res.detail);
    } catch (error) {
      applyServerErrors(error, otpForm.setError, ["otp", "new_password"]);
    }
  });

  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a 6-digit OTP code and reset link."
    >
      {sent ? (
        <Stack spacing={2}>
          <FormAlert severity="success" message={sent} />
          {resetDone ? (
            <FormAlert severity="success" message={resetDone} />
          ) : (
            <Stack
              component="form"
              spacing={2}
              noValidate
              onSubmit={onConfirmOtp}
              aria-label="Reset password with OTP"
            >
              <FormAlert message={otpForm.formState.errors.root?.server?.message} />
              <FormTextField
                name="otp"
                control={otpForm.control}
                label="6-digit OTP code"
                placeholder="123456"
                autoComplete="one-time-code"
                helperText="Enter the 6-digit OTP sent to your email."
              />
              <PasswordField
                name="new_password"
                control={otpForm.control}
                label="New password"
                autoComplete="new-password"
                helperText={`At least ${PASSWORD_MIN_LENGTH} characters, not entirely numeric.`}
              />
              <PasswordField
                name="confirm_password"
                control={otpForm.control}
                label="Confirm new password"
                autoComplete="new-password"
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={otpForm.formState.isSubmitting}
              >
                {otpForm.formState.isSubmitting ? "Resetting password…" : "Reset password with OTP"}
              </Button>
            </Stack>
          )}
        </Stack>
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
            Send reset link & OTP
          </Button>
        </Stack>
      )}
      <Link component={RouterLink} to="/login">
        Back to log in
      </Link>
    </AuthCard>
  );
}
