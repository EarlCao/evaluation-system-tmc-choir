import type { ReactNode } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { Link as RouterLink } from "react-router";

interface AppHeaderProps {
  home: string;
  badge?: string;
  nav?: ReactNode;
  children?: ReactNode;
}

export function AppHeader({ home, badge, nav, children }: AppHeaderProps) {
  return (
    <AppBar
      position="sticky"
      color="default"
      elevation={0}
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        backdropFilter: "blur(10px)",
      }}
    >
      <Toolbar
        sx={{
          gap: { xs: 1, sm: 2 },
          flexWrap: "wrap",
          py: { xs: 0.75, sm: 0.5 },
          minHeight: { xs: 56, sm: 64 },
        }}
      >
        <Box
          component={RouterLink}
          to={home}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1.25,
            color: "inherit",
            textDecoration: "none",
          }}
        >
          <Box
            aria-hidden="true"
            sx={{
              width: 34,
              height: 34,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg, #3730a3 0%, #0f766e 100%)",
              color: "#fff",
              fontSize: 18,
              boxShadow: "0 2px 8px rgba(55, 48, 163, 0.25)",
              flexShrink: 0,
            }}
          >
            🎼
          </Box>
          <Typography
            variant="subtitle1"
            component="span"
            sx={{
              fontWeight: 800,
              letterSpacing: "0.02em",
              fontSize: { xs: "0.85rem", sm: "0.95rem" },
            }}
          >
            TMC CHOIR EVALUATION SYSTEM
          </Typography>
        </Box>
        {badge ? (
          <Chip
            label={badge}
            color="secondary"
            size="small"
            sx={{ fontWeight: 700, letterSpacing: "0.02em" }}
          />
        ) : null}
        {nav}
        <Box sx={{ flexGrow: 1 }} />
        {children}
      </Toolbar>
    </AppBar>
  );
}

