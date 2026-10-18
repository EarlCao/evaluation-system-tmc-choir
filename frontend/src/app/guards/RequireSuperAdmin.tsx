import { Navigate, Outlet } from "react-router";

import { AdminLoginPage } from "@/features/auth";

import { PublicLayout } from "../layouts/PublicLayout";
import { useGuardState } from "./useGuardState";

/** Super Admin guard: renders dedicated Super Admin Login at /admin when unauthenticated; sends regular members to /app. */
export function RequireSuperAdmin() {
  const state = useGuardState();
  if (!state.ready) return state.fallback;
  if (!state.user) {
    return (
      <PublicLayout home="/admin" badge="Super Admin">
        <AdminLoginPage />
      </PublicLayout>
    );
  }
  if (!state.user.is_super_admin) return <Navigate to="/app" replace />;
  return <Outlet />;
}

