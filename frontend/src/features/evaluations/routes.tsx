import type { RouteObject } from "react-router";

import { EvaluateMemberPage } from "./pages/EvaluateMemberPage";
import { MyEvaluationDetailPage } from "./pages/MyEvaluationDetailPage";
import { MyEvaluationsPage } from "./pages/MyEvaluationsPage";

/** Member area routes (/app/...). */
export const evaluationRoutes: RouteObject[] = [
  { path: "members/:publicId/evaluate", element: <EvaluateMemberPage /> },
  { path: "my-evaluations", element: <MyEvaluationsPage /> },
  { path: "my-evaluations/:publicId", element: <MyEvaluationDetailPage /> },
];
