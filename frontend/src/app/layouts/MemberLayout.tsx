import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import SvgIcon from "@mui/material/SvgIcon";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { Outlet } from "react-router";

import { SkipLink } from "@/components/SkipLink";
import { AccountMenu } from "@/features/auth";
import { NotificationBell } from "@/features/notifications";

import { AppHeader } from "./AppHeader";
import { MemberNav } from "./MemberNav";

export function MemberLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SkipLink />
      <AppHeader home="/app" onOpenMobileNav={() => setMobileNavOpen(true)}>
        <NotificationBell base="/app" />
        <AccountMenu />
      </AppHeader>

      {/* Mobile Drawer (slides in from left with close button) */}
      <Drawer
        anchor="left"
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            width: 280,
            bgcolor: "background.paper",
            boxSizing: "border-box",
          },
        }}
      >
        <Box
          sx={{
            p: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Navigation
          </Typography>
          <IconButton
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation menu"
            size="small"
          >
            <SvgIcon fontSize="small">
              <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </SvgIcon>
          </IconButton>
        </Box>
        <MemberNav onNavigate={() => setMobileNavOpen(false)} />
      </Drawer>

      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "row",
        }}
      >
        {/* Desktop Sidebar (hidden on mobile) */}
        <Box
          sx={{
            display: { xs: "none", md: "block" },
            width: 256,
            flexShrink: 0,
            borderRight: 1,
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
          sx={{ outline: "none", flexGrow: 1, py: { xs: 2, md: 3 } }}
        >
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}

