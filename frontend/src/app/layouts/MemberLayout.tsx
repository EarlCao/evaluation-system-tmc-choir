import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { Outlet } from "react-router";

import { SkipLink } from "@/components/SkipLink";
import { useCurrentUser } from "@/features/auth";

import { AppHeader } from "./AppHeader";

export function MemberLayout() {
  const { data: user } = useCurrentUser();
  return (
    <>
      <SkipLink />
      <AppHeader home="/app">
        {user ? (
          <Typography variant="body2" color="text.secondary">
            {user.display_name || user.first_name}
          </Typography>
        ) : null}
      </AppHeader>
      <Container component="main" id="main" maxWidth="lg">
        <Outlet />
      </Container>
    </>
  );
}
