import type { RouteObject } from "react-router";

import { AdminDashboardPage } from "./pages/AdminDashboardPage";

/** Super Admin area routes (/admin/...). */
export const adminRoutes: RouteObject[] = [{ index: true, element: <AdminDashboardPage /> }];
