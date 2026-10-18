import Container from "@mui/material/Container";
import { Outlet } from "react-router";

import { SiteFooter } from "@/components/SiteFooter";

import { SkipLink } from "@/components/SkipLink";
import { useAdminLiveUpdates } from "@/features/admin";
import { AccountMenu } from "@/features/auth";
import { NotificationBell } from "@/features/notifications";

import { AdminNav } from "./AdminNav";
import { AppHeader } from "./AppHeader";

export function AdminLayout() {
  useAdminLiveUpdates();
  return (
    <>
      <SkipLink />
      <AppHeader home="/admin" badge="Super Admin" nav={<AdminNav />}>
        <NotificationBell base="/admin" />
        <AccountMenu />
      </AppHeader>
      <Container component="main" id="main" maxWidth="xl">
        <Outlet />
      </Container>
      <SiteFooter />
    </>
  );
}
