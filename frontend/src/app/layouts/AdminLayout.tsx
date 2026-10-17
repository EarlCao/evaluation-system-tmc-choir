import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { Outlet } from "react-router";

import { SkipLink } from "@/components/SkipLink";
import { useCurrentUser } from "@/features/auth";

import { AppHeader } from "./AppHeader";

export function AdminLayout() {
  const { data: user } = useCurrentUser();
  return (
    <>
      <SkipLink />
      <AppHeader home="/admin" badge="Super Admin">
        {user ? (
          <Typography variant="body2" color="text.secondary">
            {user.display_name || user.first_name}
          </Typography>
        ) : null}
      </AppHeader>
      <Container component="main" id="main" maxWidth="xl">
        <Outlet />
      </Container>
    </>
  );
}
