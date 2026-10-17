import type { RouteObject } from "react-router";

/** Lazy route: the charting library loads only when this page is opened. */
export const feedbackRoutes: RouteObject[] = [
  {
    path: "feedback",
    lazy: async () => {
      const { FeedbackPage } = await import("./pages/FeedbackPage");
      return { Component: FeedbackPage };
    },
  },
];
