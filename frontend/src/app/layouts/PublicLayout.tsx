import Container from "@mui/material/Container";
import { Outlet } from "react-router";

import { SkipLink } from "@/components/SkipLink";

import { AppHeader } from "./AppHeader";

export function PublicLayout() {
  return (
    <>
      <SkipLink />
      <AppHeader home="/" />
      <Container component="main" id="main" maxWidth="lg">
        <Outlet />
      </Container>
    </>
  );
}
