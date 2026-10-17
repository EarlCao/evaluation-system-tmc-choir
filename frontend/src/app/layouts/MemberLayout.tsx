import Container from "@mui/material/Container";
import { Outlet } from "react-router";

import { SkipLink } from "@/components/SkipLink";
import { AccountMenu } from "@/features/auth";

import { AppHeader } from "./AppHeader";
import { MemberNav } from "./MemberNav";

export function MemberLayout() {
  return (
    <>
      <SkipLink />
      <AppHeader home="/app" nav={<MemberNav />}>
        <AccountMenu />
      </AppHeader>
      <Container component="main" id="main" maxWidth="lg">
        <Outlet />
      </Container>
    </>
  );
}
