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
    <Box
      sx={{
        height: "100dvh",
        minHeight: "100vh",
        maxHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
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
        slotProps={{
          paper: {
            sx: {
              width: 280,
              bgcolor: "background.paper",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              height: "100%",
            },
          },
        }}
      >
        <Box
          sx={{
            p: 2,
            flexShrink: 0,
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
              Navigation
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
        <Box sx={{ flexGrow: 1, overflowY: "auto", overscrollBehavior: "contain" }}>
          <MemberNav onNavigate={() => setMobileNavOpen(false)} />
        </Box>
      </Drawer>

      <Box
        sx={{
          flexGrow: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "row",
          overflow: "hidden",
        }}
      >
        {/* Desktop Sidebar (fixed in place, scrolls independently if needed) */}
        <Box
          sx={{
            display: { xs: "none", md: "block" },
            width: 256,
            flexShrink: 0,
            height: "100%",
            overflowY: "auto",
            overscrollBehavior: "contain",
            borderRight: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <MemberNav />
        </Box>
        <Box
          component="main"
          id="main"
          tabIndex={-1}
          sx={{
            outline: "none",
            flexGrow: 1,
            minWidth: 0,
            height: "100%",
            overflowY: "auto",
          }}
        >
          <Container maxWidth="lg" sx={{ py: { xs: 2, md: 3 } }}>
            <Outlet />
          </Container>
        </Box>
      </Box>
    </Box>
  );
}

