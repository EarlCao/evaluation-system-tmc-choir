import { zodResolver } from "@hookform/resolvers/zod";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Link as RouterLink } from "react-router";

import { AuthCard } from "@/components/AuthCard";
import { FormAlert } from "@/components/form/FormAlert";
import { FormTextField } from "@/components/form/FormTextField";
import { PasswordField } from "@/components/form/PasswordField";
import { applyServerErrors } from "@/lib/forms";

import { useRegister, useVerifyEmailOtp, useVoiceSections } from "../queries";
import {
  PASSWORD_MIN_LENGTH,
  registerSchema,
  verifyOtpSchema,
  type RegisterInput,
  type VerifyOtpInput,
} from "../schemas";
import type { RegistrationResult } from "../types";

const SERVER_FIELDS = [
  "first_name",
  "last_name",
  "username",
  "email",
  "voice_section",
  "officer_position",
  "password",
] as const;

/** AUTH-01 / AUTH-03: registration with real 6-digit email OTP verification. */
export function RegisterPage() {
  const register = useRegister();
  const verifyOtp = useVerifyEmailOtp();
  const sections = useVoiceSections();
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [otpVerified, setOtpVerified] = useState<string | null>(null);

  const { control, handleSubmit, setError, setValue, formState } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      username: "",
      email: "",
      voice_section: "",
      is_officer: false,
      officer_position: "",
      password: "",
      confirm_password: "",
    },
  });

  const isOfficer = useWatch({ control, name: "is_officer" });

  const otpForm = useForm<VerifyOtpInput>({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: { otp: "" },
  });

  const onSubmit = handleSubmit(
    async ({ confirm_password: _confirm, voice_section, is_officer, officer_position, ...rest }) => {
      try {
        const response = await register.mutateAsync({
          ...rest,
          voice_section: Number(voice_section),
          is_officer,
          officer_position: is_officer ? officer_position.trim() : "",
        });
        setRegisteredEmail(rest.email.trim());
        setResult(response);
      } catch (error) {
        applyServerErrors(error, setError, SERVER_FIELDS);
      }
    },
  );

  const onVerifyOtp = otpForm.handleSubmit(async ({ otp }) => {
    try {
      const res = await verifyOtp.mutateAsync({ email: registeredEmail, otp });
      setOtpVerified(res.detail);
    } catch (error) {
      applyServerErrors(error, otpForm.setError, ["otp"]);
    }
  });

  if (result) {
    return (
      <AuthCard
        title={otpVerified || result.status === "ACTIVE" ? "Account created" : "Verify your email"}
        subtitle={
          !otpVerified && registeredEmail
            ? `Enter the 6-digit OTP sent to ${registeredEmail} to finish creating your account.`
            : undefined
        }
      >
        <FormAlert
          severity={otpVerified || result.status === "ACTIVE" ? "success" : "info"}
          message={otpVerified ?? result.detail}
        />
        {!otpVerified && (
          <Stack
            component="form"
            spacing={2}
            noValidate
            onSubmit={onVerifyOtp}
            aria-label="Verify email OTP"
          >
            <FormAlert message={otpForm.formState.errors.root?.server?.message} />
            <FormTextField
              name="otp"
              control={otpForm.control}
              label="6-digit OTP code"
              placeholder="123456"
              autoComplete="one-time-code"
              helperText="Your account will only be created after you verify this 6-digit OTP."
            />
            <Button
              type="submit"
              variant="contained"
              disabled={otpForm.formState.isSubmitting}
            >
              {otpForm.formState.isSubmitting ? "Verifying OTP…" : "Verify OTP"}
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() => {
                setResult(null);
                setOtpVerified(null);
              }}
            >
              Back to edit registration details
            </Button>
          </Stack>
        )}
        <Divider />
        <Button
          component={RouterLink}
          to="/login"
          variant={otpVerified || result.status === "ACTIVE" ? "contained" : "outlined"}
        >
          Go to log in
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create an account" subtitle="Join your choir's evaluation space.">
      <Stack
        component="form"
        spacing={2}
        noValidate
        onSubmit={onSubmit}
        aria-label="Create an account"
      >
        <FormAlert message={formState.errors.root?.server?.message} />
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
          name="username"
          control={control}
          label="Username"
          autoComplete="username"
          helperText="Unique username: lowercase letters (a-z), numbers (0-9), and underscores (_) only."
        />
        <FormTextField
          name="email"
          control={control}
          label="Email"
          type="email"
          autoComplete="email"
        />
        <FormTextField
          name="voice_section"
          control={control}
          label="Voice section"
          select
          disabled={sections.isPending}
          helperText={
            sections.isError ? "Couldn't load voice sections. Reload to try again." : undefined
          }
        >
          {(sections.data ?? []).map((section) => (
            <MenuItem key={section.id} value={String(section.id)}>
              {section.name}
            </MenuItem>
          ))}
        </FormTextField>
        <Controller
          name="is_officer"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(field.value)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    field.onChange(checked);
                    if (!checked) {
                      setValue("officer_position", "", { shouldValidate: false });
                    }
                  }}
                />
              }
              label="I am an officer of the choir"
            />
          )}
        />
        {isOfficer ? (
          <FormTextField
            name="officer_position"
            control={control}
            label="Officer position"
            placeholder="e.g. President, Vice President, Secretary, Section Leader"
            helperText="Enter the position you handle in the choir."
          />
        ) : null}
        <PasswordField
          name="password"
          control={control}
          label="Password"
          autoComplete="new-password"
          helperText={`At least ${PASSWORD_MIN_LENGTH} characters, not entirely numeric.`}
        />
        <PasswordField
          name="confirm_password"
          control={control}
          label="Confirm password"
          autoComplete="new-password"
        />
        <Button type="submit" variant="contained" size="large" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Already have an account?{" "}
        <Link component={RouterLink} to="/login">
          Log in
        </Link>
      </Typography>
    </AuthCard>
  );
}
