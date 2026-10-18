import { zodResolver } from "@hookform/resolvers/zod";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { useForm } from "react-hook-form";

import { AuthCard } from "@/components/AuthCard";
import { FormAlert } from "@/components/form/FormAlert";
import { FormTextField } from "@/components/form/FormTextField";
import { PasswordField } from "@/components/form/PasswordField";
import { applyServerErrors } from "@/lib/forms";

import { useLogin } from "../queries";
import { loginSchema, type LoginInput } from "../schemas";

/** Dedicated Super Admin sign-in page rendered at /admin when unauthenticated (no Forgot password, no Create account). */
export function AdminLoginPage() {
  const login = useLogin();
  const { control, handleSubmit, setError, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
    } catch (error) {
      applyServerErrors(error, setError, ["identifier", "password"]);
    }
  });

  return (
    <AuthCard
      badge="Executive Super Admin"
      title="Super Admin Log in"
      subtitle="Authorized executive sign-in for the TMC Choir Evaluation System."
    >
      <Stack
        component="form"
        spacing={2.25}
        noValidate
        onSubmit={onSubmit}
        aria-label="Super Admin Log in"
      >
        <FormAlert message={formState.errors.root?.server?.message} />
        <FormTextField
          name="identifier"
          control={control}
          label="Username or email"
          autoComplete="username"
          autoFocus
        />
        <PasswordField
          name="password"
          control={control}
          label="Password"
          autoComplete="current-password"
        />
        <Button type="submit" variant="contained" size="large" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? "Signing in…" : "Log in"}
        </Button>
      </Stack>
    </AuthCard>
  );
}
