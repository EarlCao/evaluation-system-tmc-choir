import Container from "@mui/material/Container";
import type { ReactNode } from "react";
import { Outlet } from "react-router";

import { SkipLink } from "@/components/SkipLink";

import { AppHeader } from "./AppHeader";

interface PublicLayoutProps {
  home?: string;
  badge?: string;
  children?: ReactNode;
}

/** Sign-in and public pages. */
export function PublicLayout({ home = "/", badge, children }: PublicLayoutProps = {}) {
  return (
    <>
      <SkipLink />
      <AppHeader home={home} badge={badge} />
      <Container component="main" id="main" tabIndex={-1} maxWidth="lg" sx={{ outline: "none" }}>
        {children ?? <Outlet />}
      </Container>
    </>
  );
}
