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
  children?: ReactNode;
}

export function AppHeader({ home, badge, children }: AppHeaderProps) {
  return (
    <AppBar
      position="sticky"
      color="default"
      elevation={0}
      sx={{ borderBottom: 1, borderColor: "divider" }}
    >
      <Toolbar sx={{ gap: 2 }}>
        <Typography
          component={RouterLink}
          to={home}
          variant="h6"
          sx={{ color: "inherit", textDecoration: "none", fontWeight: 600 }}
        >
          🎼 Choir Evaluation
        </Typography>
        {badge ? <Chip label={badge} color="secondary" size="small" /> : null}
        <Box sx={{ flexGrow: 1 }} />
        {children}
      </Toolbar>
    </AppBar>
  );
}
