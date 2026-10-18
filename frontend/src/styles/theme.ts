import { createTheme } from "@mui/material/styles";

/** Premium TMC Choir Evaluation System theme: WCAG AA compliant light & dark schemes. */
export const theme = createTheme({
  cssVariables: true,
  colorSchemes: {
    light: {
      palette: {
        primary: {
          main: "#3730a3",
          light: "#4f46e5",
          dark: "#1e1b4b",
          contrastText: "#ffffff",
        },
        secondary: {
          main: "#0f766e",
          light: "#14b8a6",
          dark: "#115e59",
          contrastText: "#ffffff",
        },
        background: {
          default: "#f4f6fb",
          paper: "#ffffff",
        },
        divider: "rgba(15, 23, 42, 0.08)",
      },
    },
    dark: {
      palette: {
        primary: {
          main: "#818cf8",
          light: "#a5b4fc",
          dark: "#4f46e5",
        },
        secondary: {
          main: "#2dd4bf",
          light: "#5eead4",
          dark: "#0d9488",
        },
        background: {
          default: "#0b1120",
          paper: "#111827",
        },
        divider: "rgba(255, 255, 255, 0.09)",
      },
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily:
      '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h3: { fontWeight: 800, letterSpacing: "-0.025em" },
    h4: { fontWeight: 750, letterSpacing: "-0.02em" },
    h5: { fontWeight: 700, letterSpacing: "-0.015em" },
    h6: { fontWeight: 650, letterSpacing: "-0.01em" },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 10,
          paddingInline: 16,
        },
        containedPrimary: {
          backgroundImage: "linear-gradient(135deg, #3730a3 0%, #4f46e5 100%)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        outlined: {
          borderColor: "var(--mui-palette-divider)",
          boxShadow: "0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.03)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderColor: "var(--mui-palette-divider)",
          boxShadow: "0 2px 6px -1px rgba(15, 23, 42, 0.05), 0 1px 3px -1px rgba(15, 23, 42, 0.03)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
  },
});

