import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { NavLink } from "react-router";

function NavIcon({ d }: { d: string }) {
  return (
    <SvgIcon fontSize="small" sx={{ mr: 1, opacity: 0.85 }}>
      <path d={d} />
    </SvgIcon>
  );
}

/** Super Admin side navigation (Phase 4 & 6). */
const ADMIN_LINKS: { to: string; label: string; end: boolean; icon: ReactNode }[] = [
  {
    to: "/admin",
    label: "Dashboard",
    end: true,
    icon: <NavIcon d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />,
  },
  {
    to: "/admin/members",
    label: "Members",
    end: false,
    icon: (
      <NavIcon d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    ),
  },
  {
    to: "/admin/evaluations",
    label: "Evaluations",
    end: false,
    icon: (
      <NavIcon d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    ),
  },
  {
    to: "/admin/moderation",
    label: "Moderation",
    end: false,
    icon: <NavIcon d="M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6z" />,
  },
  {
    to: "/admin/reports",
    label: "Reports",
    end: false,
    icon: <NavIcon d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />,
  },
  {
    to: "/admin/cycles",
    label: "Periods",
    end: false,
    icon: (
      <NavIcon d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z" />
    ),
  },
  {
    to: "/admin/criteria",
    label: "Criteria",
    end: false,
    icon: <NavIcon d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />,
  },
  {
    to: "/admin/forms",
    label: "Forms",
    end: false,
    icon: <NavIcon d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />,
  },
  {
    to: "/admin/audit",
    label: "Audit log",
    end: false,
    icon: <NavIcon d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />,
  },
  {
    to: "/admin/data-management",
    label: "Data Management",
    end: false,
    icon: (
      <NavIcon d="M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2zm0 2c4.42 0 8 1.43 8 2.5S16.42 9 12 9s-8-1.43-8-2.5S7.58 4 12 4zm8 13.5c0 1.07-3.58 2.5-8 2.5s-8-1.43-8-2.5V15c1.94 1.25 5.02 2 8 2s6.06-.75 8-2v2.5zm0-4.5c0 1.07-3.58 2.5-8 2.5s-8-1.43-8-2.5V10.5c1.94 1.25 5.02 2 8 2s6.06-.75 8-2V13z" />
    ),
  },
  {
    to: "/admin/settings",
    label: "Settings",
    end: false,
    icon: (
      <NavIcon d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    ),
  },
];

interface AdminNavProps {
  onNavigate?: () => void;
}

export function AdminNav({ onNavigate }: AdminNavProps = {}) {
  return (
    <Box
      component="nav"
      aria-label="Admin"
      sx={{
        p: { xs: 1.5, md: 2 },
      }}
    >
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{
          display: "block",
          px: 1.5,
          pb: 1,
          fontWeight: 800,
          letterSpacing: "0.1em",
        }}
      >
        Super Admin Console
      </Typography>
      <Stack
        direction="column"
        spacing={0.5}
      >
        {ADMIN_LINKS.map((link) => (
          <Button
            key={link.to}
            component={NavLink}
            to={link.to}
            end={link.end}
            size="medium"
            color="inherit"
            onClick={onNavigate}
            sx={{
              justifyContent: "flex-start",
              px: { xs: 1.5, md: 1.75 },
              py: { xs: 0.85, md: 1.05 },
              borderRadius: 2.5,
              fontWeight: 600,
              color: "text.secondary",
              border: "1px solid transparent",
              "&:hover": {
                bgcolor: "action.hover",
                color: "text.primary",
              },
              "&.active": {
                color: "primary.main",
                bgcolor: "rgba(212, 175, 55, 0.12)",
                borderColor: "rgba(212, 175, 55, 0.35)",
                fontWeight: 800,
              },
            }}
          >
            {link.icon}
            {link.label}
          </Button>
        ))}
      </Stack>
    </Box>
  );
}


