import { render } from "@testing-library/react";
import { createMemoryRouter, type RouteObject } from "react-router";
import { RouterProvider } from "react-router/dom";

import { AppProviders } from "@/app/providers";
import { routes as appRoutes } from "@/app/routes";
import { createQueryClient } from "@/lib/queryClient";

/** Render the real route tree at `path`, with fresh providers and no query retries. */
export function renderRoute(path: string, routes: RouteObject[] = appRoutes) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = createQueryClient({ retry: false });
  const result = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...result, router, queryClient };
}
