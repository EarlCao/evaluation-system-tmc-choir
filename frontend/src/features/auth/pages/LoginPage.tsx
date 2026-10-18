import { zodResolver } from "@hookform/resolvers/zod";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useForm } from "react-hook-form";
import { Link as RouterLink } from "react-router";

import { AuthCard } from "@/components/AuthCard";
import { FormAlert } from "@/components/form/FormAlert";
import { FormTextField } from "@/components/form/FormTextField";
import { PasswordField } from "@/components/form/PasswordField";
import { applyServerErrors } from "@/lib/forms";

import { useLogin } from "../queries";
import { loginSchema, type LoginInput } from "../schemas";

/** AUTH-02: Purely Choir Member sign-in page (rendered at / and /login). */
export function LoginPage() {
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
      badge="Choir Member Portal"
      title="Log in"
      subtitle="Sign in to your TMC Choir member account using your username or email."
    >
      <Stack component="form" spacing={2.25} noValidate onSubmit={onSubmit} aria-label="Log in">
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
          {formState.isSubmitting ? "Logging in…" : "Log in"}
        </Button>
      </Stack>

      <Divider />

      <Stack spacing={1.25}>
        <Link component={RouterLink} to="/forgot-password" sx={{ fontWeight: 600 }}>
          Forgot your password?
        </Link>
        <Typography variant="body2" color="text.secondary">
          New here?{" "}
          <Link component={RouterLink} to="/register" sx={{ fontWeight: 600 }}>
            Create an account
          </Link>
          . If you registered recently, your account may still be waiting for approval.
        </Typography>
      </Stack>
    </AuthCard>
  );
}



