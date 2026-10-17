import { Navigate, Outlet, useLocation } from "react-router";

import { fromState, postLoginPath } from "@/features/auth";

import { useGuardState } from "./useGuardState";

/** Login/register pages: logged-in users go back where they came from, or to their home area. */
export function GuestOnly() {
  const location = useLocation();
  const state = useGuardState();
  if (!state.ready) return state.fallback;
  if (state.user) {
    return <Navigate to={postLoginPath(state.user, fromState(location.state))} replace />;
  }
  return <Outlet />;
}
