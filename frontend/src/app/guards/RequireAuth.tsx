import { Navigate, Outlet, useLocation } from "react-router";

import { useGuardState } from "./useGuardState";

/** Logged-in users only; others go to /login (and come back afterwards). */
export function RequireAuth() {
  const location = useLocation();
  const state = useGuardState();
  if (!state.ready) return state.fallback;
  if (!state.user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
