import type { RouteObject } from "react-router";

import { MemberDirectoryPage } from "./pages/MemberDirectoryPage";
import { MemberProfilePage } from "./pages/MemberProfilePage";

/** Member area routes (/app/...). */
export const memberRoutes: RouteObject[] = [
  { path: "members", element: <MemberDirectoryPage /> },
  { path: "members/:publicId", element: <MemberProfilePage /> },
];
