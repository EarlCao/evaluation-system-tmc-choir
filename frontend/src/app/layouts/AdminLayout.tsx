import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import { Outlet } from "react-router";

import { SkipLink } from "@/components/SkipLink";
import { useAdminLiveUpdates } from "@/features/admin";
import { AccountMenu } from "@/features/auth";
import { NotificationBell } from "@/features/notifications";

import { AdminNav } from "./AdminNav";
import { AppHeader } from "./AppHeader";

export function AdminLayout() {
  useAdminLiveUpdates();
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SkipLink />
      <AppHeader home="/admin" badge="Super Admin">
        <NotificationBell base="/admin" />
        <AccountMenu />
      </AppHeader>
      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
        }}
      >
        <Box
          sx={{
            width: { xs: "100%", md: 256 },
            flexShrink: 0,
            borderRight: { md: 1 },
            borderBottom: { xs: 1, md: 0 },
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <AdminNav />
        </Box>
        <Container
          component="main"
          id="main"
          tabIndex={-1}
          maxWidth="xl"
          sx={{ outline: "none", flexGrow: 1, py: 1 }}
        >
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}

