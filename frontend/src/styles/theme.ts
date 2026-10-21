import { createTheme, type Theme } from "@mui/material/styles";
import { createContext, useContext } from "react";

export type ThemeMode = "light" | "dark";

export interface ThemeModeContextValue {
  mode: ThemeMode;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
}

export const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: "light",
  toggleMode: () => undefined,
  setMode: () => undefined,
});

export function useThemeMode(): ThemeModeContextValue {
  return useContext(ThemeModeContext);
}

/** Luxury bespoke theme for TMC CHOIR EVALUATION SYSTEM (WCAG AA compliant Light & Dark modes). */
export function createLuxuryTheme(mode: ThemeMode): Theme {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: isDark
        ? {
            main: "#d4af37",
            light: "#e6c762",
            dark: "#aa8620",
            contrastText: "#07090e",
          }
        : {
            main: "#1e1b4b",
            light: "#312e81",
            dark: "#0f172a",
            contrastText: "#ffffff",
          },
      secondary: isDark
        ? {
            main: "#93c5fd",
            light: "#bfdbfe",
            dark: "#60a5fa",
            contrastText: "#07090e",
          }
        : {
            main: "#9a7316",
            light: "#b48a2e",
            dark: "#78570d",
            contrastText: "#ffffff",
          },
      background: isDark
        ? {
            default: "#07090e",
            paper: "#0f1420",
          }
        : {
            default: "#f7f5f0",
            paper: "#ffffff",
          },
      text: isDark
        ? {
            primary: "#f8fafc",
            secondary: "#94a3b8",
          }
        : {
            primary: "#0f172a",
            secondary: "#475569",
          },
      divider: isDark ? "rgba(212, 175, 55, 0.18)" : "rgba(180, 138, 46, 0.22)",
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily:
        '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      h3: { fontWeight: 800, letterSpacing: "-0.025em" },
      h4: { fontWeight: 800, letterSpacing: "-0.02em" },
      h5: { fontWeight: 700, letterSpacing: "-0.015em" },
      h6: { fontWeight: 700, letterSpacing: "-0.01em" },
      overline: { letterSpacing: "0.12em", fontWeight: 700 },
      button: { textTransform: "none", fontWeight: 600, letterSpacing: "0.01em" },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundImage: isDark
              ? "radial-gradient(circle at 15% 10%, rgba(212, 175, 55, 0.08) 0%, transparent 45%), radial-gradient(circle at 85% 90%, rgba(99, 102, 241, 0.07) 0%, transparent 45%)"
              : "radial-gradient(circle at 15% 10%, rgba(212, 175, 55, 0.09) 0%, transparent 45%), radial-gradient(circle at 85% 90%, rgba(30, 27, 75, 0.05) 0%, transparent 45%)",
            backgroundAttachment: "fixed",
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 10,
            paddingInline: 18,
            transition: "all 160ms ease",
            "&.MuiButton-contained.MuiButton-colorPrimary": {
              backgroundImage: isDark
                ? "linear-gradient(135deg, #d4af37 0%, #f3d266 50%, #b89024 100%)"
                : "linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)",
              boxShadow: isDark
                ? "0 4px 16px rgba(212, 175, 55, 0.25)"
                : "0 4px 14px rgba(30, 27, 75, 0.22)",
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          outlined: {
            borderColor: isDark ? "rgba(212, 175, 55, 0.2)" : "rgba(180, 138, 46, 0.22)",
            boxShadow: isDark
              ? "0 10px 30px -5px rgba(0, 0, 0, 0.55)"
              : "0 8px 24px -4px rgba(15, 23, 42, 0.05)",
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderColor: isDark ? "rgba(212, 175, 55, 0.2)" : "rgba(180, 138, 46, 0.22)",
            boxShadow: isDark
              ? "0 10px 30px -5px rgba(0, 0, 0, 0.5)"
              : "0 8px 24px -4px rgba(15, 23, 42, 0.05)",
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 700,
            letterSpacing: "0.02em",
          },
        },
      },
    },
  });
}

export const theme = createLuxuryTheme("light");
