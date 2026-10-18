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

const LINKS: { to: string; label: string; end: boolean; icon: ReactNode }[] = [
  {
    to: "/app",
    label: "Dashboard",
    end: true,
    icon: <NavIcon d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />,
  },
  {
    to: "/app/members",
    label: "Members",
    end: false,
    icon: (
      <NavIcon d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    ),
  },
  {
    to: "/app/my-evaluations",
    label: "My evaluations",
    end: false,
    icon: (
      <NavIcon d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    ),
  },
  {
    to: "/app/feedback",
    label: "Feedback",
    end: false,
    icon: (
      <NavIcon d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
    ),
  },
];

/** Primary side navigation of the member area. NavLink sets aria-current="page". */
export function MemberNav() {
  return (
    <Box
      component="nav"
      aria-label="Main"
      sx={{
        p: { xs: 1, md: 2 },
      }}
    >
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{
          display: { xs: "none", md: "block" },
          px: 1.5,
          pb: 1,
          fontWeight: 700,
          letterSpacing: "0.08em",
        }}
      >
        Member Workspace
      </Typography>
      <Stack
        direction={{ xs: "row", md: "column" }}
        spacing={0.5}
        sx={{ flexWrap: "wrap" }}
      >
        {LINKS.map((link) => (
          <Button
            key={link.to}
            component={NavLink}
            to={link.to}
            end={link.end}
            size="medium"
            color="inherit"
            sx={{
              justifyContent: { xs: "center", md: "flex-start" },
              px: { xs: 1.25, md: 1.75 },
              py: { xs: 0.75, md: 1.1 },
              borderRadius: 2,
              fontWeight: 500,
              color: "text.secondary",
              "&:hover": {
                bgcolor: "action.hover",
                color: "text.primary",
              },
              "&.active": {
                color: "primary.main",
                bgcolor: "rgba(55, 48, 163, 0.09)",
                fontWeight: 700,
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

