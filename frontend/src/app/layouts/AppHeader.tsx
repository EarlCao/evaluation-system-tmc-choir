import type { ReactNode } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import SvgIcon from "@mui/material/SvgIcon";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { Link as RouterLink } from "react-router";

import { useThemeMode } from "@/styles/theme";

import IconButton from "@mui/material/IconButton";

interface AppHeaderProps {
  home: string;
  badge?: string;
  nav?: ReactNode;
  children?: ReactNode;
  onOpenMobileNav?: () => void;
}

export function AppHeader({ home, badge, nav, children, onOpenMobileNav }: AppHeaderProps) {
  const { mode, toggleMode } = useThemeMode();
  const isDark = mode === "dark";

  return (
    <AppBar
      position="sticky"
      color="default"
      elevation={0}
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: isDark ? "rgba(15, 20, 32, 0.88)" : "rgba(255, 255, 255, 0.88)",
        backdropFilter: "blur(16px)",
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          height: 2,
          background: "linear-gradient(90deg, #1e1b4b 0%, #d4af37 50%, #0f766e 100%)",
        }}
      />
      <Toolbar
        sx={{
          gap: { xs: 1, sm: 2 },
          flexWrap: "wrap",
          py: { xs: 0.75, sm: 0.75 },
          minHeight: { xs: 58, sm: 68 },
        }}
      >
        {onOpenMobileNav ? (
          <IconButton
            type="button"
            color="inherit"
            onClick={onOpenMobileNav}
            aria-label="Open navigation menu"
            sx={{
              display: { xs: "inline-flex", md: "none" },
              mr: { xs: 0.5, sm: 1 },
              p: 0.75,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
            }}
          >
            <SvgIcon fontSize="small">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
            </SvgIcon>
          </IconButton>
        ) : null}
        <Box
          component={RouterLink}
          to={home}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1.5,
            color: "inherit",
            textDecoration: "none",
          }}
        >
          <Box
            component="img"
            src="/logo.png"
            alt="Alon Himig Logo"
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2,
              objectFit: "contain",
              flexShrink: 0,
              filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.2))",
            }}
          />
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            <Typography
              variant="subtitle1"
              component="span"
              sx={{
                fontWeight: 800,
                letterSpacing: "0.04em",
                lineHeight: 1.15,
                fontSize: { xs: "0.82rem", sm: "0.95rem" },
              }}
            >
              TMC CHOIR EVALUATION SYSTEM
            </Typography>
          </Box>
        </Box>
        {badge ? (
          <Chip
            label={badge}
            color="secondary"
            size="small"
            sx={{
              fontWeight: 800,
              letterSpacing: "0.04em",
              border: "1px solid rgba(212, 175, 55, 0.35)",
            }}
          />
        ) : null}
        {nav}
        <Box sx={{ flexGrow: 1 }} />
        <Button
          type="button"
          size="small"
          variant="outlined"
          color="inherit"
          onClick={toggleMode}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          sx={{
            borderColor: "divider",
            borderRadius: 999,
            px: 1.5,
            py: 0.5,
            gap: 0.75,
            minWidth: "auto",
            fontSize: "0.78rem",
            fontWeight: 700,
          }}
        >
          <SvgIcon fontSize="small" sx={{ fontSize: 17, color: isDark ? "#f3d266" : "#9a7316" }}>
            {isDark ? (
              <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0 1.41.996.996 0 0 0 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06z" />
            ) : (
              <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
            )}
          </SvgIcon>
          {isDark ? "Light" : "Dark"}
        </Button>
        {children}
      </Toolbar>
    </AppBar>
  );
}


