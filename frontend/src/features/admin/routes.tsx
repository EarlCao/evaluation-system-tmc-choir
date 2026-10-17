import type { RouteObject } from "react-router";

import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { AdminMemberPage } from "./pages/AdminMemberPage";
import { AdminMembersPage } from "./pages/AdminMembersPage";
import { AdminVoiceSectionsPage } from "./pages/AdminVoiceSectionsPage";

/** Super Admin area routes (/admin/...). */
export const adminRoutes: RouteObject[] = [
  { index: true, element: <AdminDashboardPage /> },
  { path: "members", element: <AdminMembersPage /> },
  { path: "members/:publicId", element: <AdminMemberPage /> },
  { path: "voice-sections", element: <AdminVoiceSectionsPage /> },
];
