import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import { Outlet } from "react-router";

import { SkipLink } from "@/components/SkipLink";
import { AccountMenu } from "@/features/auth";
import { NotificationBell } from "@/features/notifications";

import { AppHeader } from "./AppHeader";
import { MemberNav } from "./MemberNav";

export function MemberLayout() {
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SkipLink />
      <AppHeader home="/app">
        <NotificationBell base="/app" />
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
          <MemberNav />
        </Box>
        <Container
          component="main"
          id="main"
          tabIndex={-1}
          maxWidth="lg"
          sx={{ outline: "none", flexGrow: 1, py: 1 }}
        >
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}

