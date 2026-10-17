import { zodResolver } from "@hookform/resolvers/zod";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link as RouterLink } from "react-router";

import { AuthCard } from "@/components/AuthCard";
import { FormAlert } from "@/components/form/FormAlert";
import { FormTextField } from "@/components/form/FormTextField";
import { PasswordField } from "@/components/form/PasswordField";
import { applyServerErrors } from "@/lib/forms";

import { useRegister, useVoiceSections } from "../queries";
import { PASSWORD_MIN_LENGTH, registerSchema, type RegisterInput } from "../schemas";
import type { RegistrationResult } from "../types";

const SERVER_FIELDS = [
  "first_name",
  "last_name",
  "username",
  "email",
  "voice_section",
  "password",
] as const;

/** AUTH-01 / AUTH-03: registration. The next step depends on the registration mode. */
export function RegisterPage() {
  const register = useRegister();
  const sections = useVoiceSections();
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const { control, handleSubmit, setError, formState } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      username: "",
      email: "",
      voice_section: "",
      password: "",
      confirm_password: "",
    },
  });

  const onSubmit = handleSubmit(async ({ confirm_password: _confirm, voice_section, ...rest }) => {
    try {
      setResult(await register.mutateAsync({ ...rest, voice_section: Number(voice_section) }));
    } catch (error) {
      applyServerErrors(error, setError, SERVER_FIELDS);
    }
  });

  if (result) {
    return (
      <AuthCard title={result.status === "ACTIVE" ? "Account created" : "Almost there"}>
        <FormAlert
          severity={result.status === "ACTIVE" ? "success" : "info"}
          message={result.detail}
        />
        <Button component={RouterLink} to="/login" variant="contained">
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
        <FormTextField name="username" control={control} label="Username" autoComplete="username" />
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
