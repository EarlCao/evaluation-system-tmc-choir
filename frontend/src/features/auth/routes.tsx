import type { RouteObject } from "react-router";

import { ComingSoon } from "@/components/ComingSoon";

import { WelcomePage } from "./pages/WelcomePage";

/** Public pages (anyone). */
export const publicAuthRoutes: RouteObject[] = [{ index: true, element: <WelcomePage /> }];

/** Pages for visitors who are not logged in (GuestOnly). Real pages arrive in step 1.6. */
export const guestAuthRoutes: RouteObject[] = [
  { path: "login", element: <ComingSoon title="Log in" step="1.6" /> },
  { path: "register", element: <ComingSoon title="Create an account" step="1.6" /> },
  { path: "forgot-password", element: <ComingSoon title="Forgot password" step="1.6" /> },
];
