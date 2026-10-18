import type { RouteObject } from "react-router";

import { AdminLoginPage } from "./pages/AdminLoginPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { LoginPage } from "./pages/LoginPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RegisterPage } from "./pages/RegisterPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";

/** Public pages (anyone, logged in or not). Email links land here. */
export const publicAuthRoutes: RouteObject[] = [
  { path: "privacy", element: <PrivacyPage /> },
  { path: "reset-password/:uid/:token", element: <ResetPasswordPage /> },
  { path: "verify-email/:uid/:token", element: <VerifyEmailPage /> },
];

/** Pages for visitors who are not logged in (GuestOnly). */
export const guestAuthRoutes: RouteObject[] = [
  { index: true, element: <LoginPage /> },
  { path: "login", element: <LoginPage /> },
  { path: "admin/login", element: <AdminLoginPage /> },
  { path: "register", element: <RegisterPage /> },
  { path: "forgot-password", element: <ForgotPasswordPage /> },
];

/** Pages inside the member area (/app/...). */
export const memberAuthRoutes: RouteObject[] = [{ path: "profile", element: <ProfilePage /> }];

