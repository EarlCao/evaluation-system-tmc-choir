import type { RouteObject } from "react-router";

import { ComingSoon } from "@/components/ComingSoon";
import { NotFoundPage } from "@/components/NotFoundPage";
import { RouteErrorPage } from "@/components/RouteErrorPage";
import { guestAuthRoutes, memberAuthRoutes, publicAuthRoutes } from "@/features/auth";
import { dashboardRoutes } from "@/features/dashboard";
import { evaluationRoutes } from "@/features/evaluations";
import { memberRoutes } from "@/features/members";

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
              ...memberAuthRoutes,
            ],
          },
          {
            element: <RequireSuperAdmin />,
            children: [
              {
                path: "admin",
                element: <AdminLayout />,
                children: [
                  { index: true, element: <ComingSoon title="Super Admin dashboard" step="4.1" /> },
                ],
              },
            ],
          },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
