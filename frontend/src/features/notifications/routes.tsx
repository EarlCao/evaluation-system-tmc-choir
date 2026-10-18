import type { RouteObject } from "react-router";

import { NotificationsPage } from "./pages/NotificationsPage";

/** Mounted under both /app and /admin (everyone has notifications). */
export const notificationRoutes: RouteObject[] = [
  { path: "notifications", element: <NotificationsPage /> },
];
