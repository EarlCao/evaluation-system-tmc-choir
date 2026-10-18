import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import SvgIcon from "@mui/material/SvgIcon";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { Outlet } from "react-router";

import { SkipLink } from "@/components/SkipLink";
import { useAdminLiveUpdates } from "@/features/admin";
import { AccountMenu } from "@/features/auth";
import { NotificationBell } from "@/features/notifications";

import { AdminNav } from "./AdminNav";
import { AppHeader } from "./AppHeader";

export function AdminLayout() {
  useAdminLiveUpdates();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SkipLink />
      <AppHeader
        home="/admin"
        badge="Super Admin"
        onOpenMobileNav={() => setMobileNavOpen(true)}
      >
        <NotificationBell base="/admin" />
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              component="img"
              src="/logo.png"
              alt="Logo"
              sx={{ width: 28, height: 28, objectFit: "contain" }}
            />
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Super Admin Menu
            </Typography>
          </Box>
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
        <AdminNav onNavigate={() => setMobileNavOpen(false)} />
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
          <AdminNav />
        </Box>
        <Container
          component="main"
          id="main"
          tabIndex={-1}
          maxWidth="xl"
          sx={{ outline: "none", flexGrow: 1, py: { xs: 2, md: 3 } }}
        >
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}

