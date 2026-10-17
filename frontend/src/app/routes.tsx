import type { RouteObject } from "react-router";

import { NotFoundPage } from "@/components/NotFoundPage";
import { RouteErrorPage } from "@/components/RouteErrorPage";
import { adminRoutes } from "@/features/admin";
import { guestAuthRoutes, memberAuthRoutes, publicAuthRoutes } from "@/features/auth";
import { dashboardRoutes } from "@/features/dashboard";
import { evaluationRoutes } from "@/features/evaluations";
import { feedbackRoutes } from "@/features/feedback";
import { memberRoutes } from "@/features/members";
import { adminReportRoutes } from "@/features/reports";

import { GuestOnly } from "./guards/GuestOnly";
import { RequireAuth } from "./guards/RequireAuth";
import { RequireSuperAdmin } from "./guards/RequireSuperAdmin";
import { AdminLayout } from "./layouts/AdminLayout";
import { MemberLayout } from "./layouts/MemberLayout";
import { PublicLayout } from "./layouts/PublicLayout";

/** Route tree (docs/02-Requirements/Pages and Routes). Features contribute their routes. */
export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicLayout />,
        children: [...publicAuthRoutes, { element: <GuestOnly />, children: guestAuthRoutes }],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: "app",
            element: <MemberLayout />,
            children: [
              ...dashboardRoutes,
              ...memberRoutes,
              ...evaluationRoutes,
              ...feedbackRoutes,
              ...memberAuthRoutes,
            ],
          },
          {
            element: <RequireSuperAdmin />,
            children: [
              {
                path: "admin",
                element: <AdminLayout />,
                children: [...adminRoutes, ...adminReportRoutes],
              },
            ],
          },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
