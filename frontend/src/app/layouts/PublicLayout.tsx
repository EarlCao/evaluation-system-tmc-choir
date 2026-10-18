import Container from "@mui/material/Container";
import { Outlet } from "react-router";

import { SkipLink } from "@/components/SkipLink";

import { AppHeader } from "./AppHeader";

/** Welcome and sign-in pages. No footer here (user request 2026-10-18); the privacy link
 * lives in the member and admin layouts, and /privacy itself stays public. */
export function PublicLayout() {
  return (
    <>
      <SkipLink />
      <AppHeader home="/" />
      <Container component="main" id="main" tabIndex={-1} maxWidth="lg" sx={{ outline: "none" }}>
        <Outlet />
      </Container>
    </>
  );
}
