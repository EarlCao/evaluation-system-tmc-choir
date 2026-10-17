import { Navigate, Outlet } from "react-router";

import { useGuardState } from "./useGuardState";

/** Login/register pages: logged-in users are sent to their home area. */
export function GuestOnly() {
  const state = useGuardState();
  if (!state.ready) return state.fallback;
  if (state.user) return <Navigate to={state.user.is_super_admin ? "/admin" : "/app"} replace />;
  return <Outlet />;
}
