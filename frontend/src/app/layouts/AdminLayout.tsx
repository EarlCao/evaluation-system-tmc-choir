import Container from "@mui/material/Container";
import { Outlet } from "react-router";

import { SkipLink } from "@/components/SkipLink";
import { AccountMenu } from "@/features/auth";

import { AdminNav } from "./AdminNav";
import { AppHeader } from "./AppHeader";

export function AdminLayout() {
  return (
    <>
      <SkipLink />
      <AppHeader home="/admin" badge="Super Admin" nav={<AdminNav />}>
        <AccountMenu />
      </AppHeader>
      <Container component="main" id="main" maxWidth="xl">
        <Outlet />
      </Container>
    </>
  );
}
