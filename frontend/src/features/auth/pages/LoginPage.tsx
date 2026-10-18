import { zodResolver } from "@hookform/resolvers/zod";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link as RouterLink, useLocation, useSearchParams } from "react-router";

import { AuthCard } from "@/components/AuthCard";
import { FormAlert } from "@/components/form/FormAlert";
import { FormTextField } from "@/components/form/FormTextField";
import { PasswordField } from "@/components/form/PasswordField";
import { applyServerErrors } from "@/lib/forms";

import { useLogin } from "../queries";
import { fromState } from "../redirects";
import { loginSchema, type LoginInput } from "../schemas";

/** AUTH-02. On success the session query updates and GuestOnly redirects (postLoginPath). */
export function LoginPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const fromPath = fromState(location.state);
  const initialAdmin =
    searchParams.get("role") === "admin" || Boolean(fromPath?.startsWith("/admin"));
  const [mode, setMode] = useState<"member" | "admin">(initialAdmin ? "admin" : "member");

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

  const isSuperAdmin = mode === "admin";

  function selectMode(nextMode: "member" | "admin") {
    setMode(nextMode);
    if (nextMode === "admin") {
      setSearchParams({ role: "admin" }, { replace: true });
    } else if (searchParams.has("role")) {
      setSearchParams({}, { replace: true });
    }
  }

  return (
    <AuthCard
      title="Log in"
      subtitle={
        isSuperAdmin
          ? "Super Admin console sign-in. Use your administrator credentials."
          : "Sign in to your TMC Choir member account using your username or email."
      }
    >
      <Box
        role="group"
        aria-label="Sign-in portal"
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 0.75,
          p: 0.5,
          borderRadius: 2,
          bgcolor: "action.hover",
        }}
      >
        <Button
          type="button"
          size="small"
          variant={mode === "member" ? "contained" : "text"}
          color={mode === "member" ? "primary" : "inherit"}
          aria-pressed={mode === "member"}
          onClick={() => {
            selectMode("member");
          }}
        >
          Choir Member
        </Button>
        <Button
          type="button"
          size="small"
          variant={mode === "admin" ? "contained" : "text"}
          color={mode === "admin" ? "secondary" : "inherit"}
          aria-pressed={mode === "admin"}
          onClick={() => {
            selectMode("admin");
          }}
        >
          Super Admin
        </Button>
      </Box>

      <Stack component="form" spacing={2} noValidate onSubmit={onSubmit} aria-label="Log in">
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

      {!isSuperAdmin ? (
        <Stack spacing={1}>
          <Link component={RouterLink} to="/forgot-password">
            Forgot your password?
          </Link>
          <Typography variant="body2" color="text.secondary">
            New here?{" "}
            <Link component={RouterLink} to="/register">
              Create an account
            </Link>
            . If you registered recently, your account may still be waiting for approval.
          </Typography>
        </Stack>
      ) : null}
    </AuthCard>
  );
}

