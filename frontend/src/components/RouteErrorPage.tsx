import Container from "@mui/material/Container";
import { isRouteErrorResponse, useRouteError } from "react-router";

import { ErrorState } from "./ErrorState";
import { NotFoundPage } from "./NotFoundPage";

/** Router-level error boundary: never shows stack traces or raw error details. */
export function RouteErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return (
    <Container maxWidth="sm">
      <ErrorState
        message="Something went wrong while showing this page. Please reload."
        onRetry={() => {
          window.location.reload();
        }}
      />
    </Container>
  );
}
