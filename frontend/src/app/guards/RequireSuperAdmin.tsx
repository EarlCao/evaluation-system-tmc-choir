import { Navigate, Outlet } from "react-router";

import { useGuardState } from "./useGuardState";

/** Super Admin only (nest inside RequireAuth). Members are sent to their dashboard. */
export function RequireSuperAdmin() {
  const state = useGuardState();
  if (!state.ready) return state.fallback;
  if (!state.user) return <Navigate to="/login" replace />;
  if (!state.user.is_super_admin) return <Navigate to="/app" replace />;
  return <Outlet />;
}
