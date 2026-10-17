import type { RouteObject } from "react-router";

/** Super Admin report routes, mounted under /admin. Lazy: loaded only when opened. */
export const adminReportRoutes: RouteObject[] = [
  {
    path: "reports",
    lazy: async () => {
      const { ReportsPage } = await import("./pages/ReportsPage");
      return { Component: ReportsPage };
    },
  },
  {
    path: "reports/members/:publicId",
    lazy: async () => {
      const { MemberReportPage } = await import("./pages/MemberReportPage");
      return { Component: MemberReportPage };
    },
  },
];
