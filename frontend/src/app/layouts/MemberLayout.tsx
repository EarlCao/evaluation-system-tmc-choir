import Container from "@mui/material/Container";
import { Outlet } from "react-router";

import { SiteFooter } from "@/components/SiteFooter";

import { SkipLink } from "@/components/SkipLink";
import { AccountMenu } from "@/features/auth";
import { NotificationBell } from "@/features/notifications";

import { AppHeader } from "./AppHeader";
import { MemberNav } from "./MemberNav";

export function MemberLayout() {
  return (
    <>
      <SkipLink />
      <AppHeader home="/app" nav={<MemberNav />}>
        <NotificationBell base="/app" />
        <AccountMenu />
      </AppHeader>
      <Container component="main" id="main" maxWidth="lg">
        <Outlet />
      </Container>
      <SiteFooter />
    </>
  );
}
