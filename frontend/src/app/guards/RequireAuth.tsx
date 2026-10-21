import { Navigate, Outlet, useLocation } from "react-router";

import { useGuardState } from "./useGuardState";

/** Logged-in Choir Members only; Super Admins only have the Super Admin console (/admin). */
export function RequireAuth() {
  const location = useLocation();
  const state = useGuardState();
  if (!state.ready) return state.fallback;
  if (!state.user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (state.user.is_super_admin) return <Navigate to="/admin" replace />;
  return <Outlet />;
}
