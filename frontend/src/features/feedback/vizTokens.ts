import type { Theme } from "@mui/material/styles";

/**
 * Chart tokens (dataviz reference palette). Single series = categorical slot 1 (blue), with a
 * dark step chosen for the dark surface. Validated with the dataviz validator against the real
 * surfaces: #2a78d6 on #ffffff (light) and #3987e5 on #121212 (dark) both PASS.
 */
export function vizVars(theme: Theme) {
  return {
    "--viz-series": "#2a78d6",
    "--viz-track": "#cde2fb",
    "--viz-grid": "#e1e0d9",
    "--viz-axis": "#c3c2b7",
    "--viz-muted": "#6b6a65",
    // Follows the active color scheme (MUI CSS variables), used for the 2px dot ring.
    "--viz-surface": theme.vars?.palette.background.paper ?? theme.palette.background.paper,
    ...theme.applyStyles("dark", {
      "--viz-series": "#3987e5",
      "--viz-track": "#184f95",
      "--viz-grid": "#2c2c2a",
      "--viz-axis": "#383835",
      "--viz-muted": "#a3a29b",
    }),
  };
}
