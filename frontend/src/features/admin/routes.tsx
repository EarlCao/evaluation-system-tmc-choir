import type { RouteObject } from "react-router";

import { AdminAuditPage } from "./pages/AdminAuditPage";
import { AdminCriteriaPage } from "./pages/AdminCriteriaPage";
import { AdminCyclePage } from "./pages/AdminCyclePage";
import { AdminCyclesPage } from "./pages/AdminCyclesPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { AdminEvaluationPage } from "./pages/AdminEvaluationPage";
import { AdminEvaluationsPage } from "./pages/AdminEvaluationsPage";
import { AdminFormEditorPage } from "./pages/AdminFormEditorPage";
import { AdminFormsPage } from "./pages/AdminFormsPage";
import { AdminMemberPage } from "./pages/AdminMemberPage";
import { AdminMembersPage } from "./pages/AdminMembersPage";
import { AdminModerationPage } from "./pages/AdminModerationPage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";
import { AdminVoiceSectionsPage } from "./pages/AdminVoiceSectionsPage";

/** Super Admin area routes (/admin/...). */
export const adminRoutes: RouteObject[] = [
  { index: true, element: <AdminDashboardPage /> },
  { path: "members", element: <AdminMembersPage /> },
  { path: "members/:publicId", element: <AdminMemberPage /> },
  { path: "voice-sections", element: <AdminVoiceSectionsPage /> },
  { path: "cycles", element: <AdminCyclesPage /> },
  { path: "cycles/new", element: <AdminCyclePage /> },
  { path: "cycles/:publicId", element: <AdminCyclePage /> },
  { path: "criteria", element: <AdminCriteriaPage /> },
  { path: "forms", element: <AdminFormsPage /> },
  { path: "forms/new", element: <AdminFormEditorPage /> },
  { path: "forms/:publicId", element: <AdminFormEditorPage /> },
  { path: "evaluations", element: <AdminEvaluationsPage /> },
  { path: "evaluations/:publicId", element: <AdminEvaluationPage /> },
  { path: "moderation", element: <AdminModerationPage /> },
  { path: "audit", element: <AdminAuditPage /> },
  { path: "settings", element: <AdminSettingsPage /> },
];
