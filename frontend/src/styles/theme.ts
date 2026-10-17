import { createTheme } from "@mui/material/styles";

/** App theme: light and dark schemes follow the OS preference (WCAG AA contrast). */
export const theme = createTheme({
  cssVariables: true,
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#3949ab" },
        secondary: { main: "#00796b" },
        background: { default: "#f6f7fb" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#9fa8da" },
        secondary: { main: "#80cbc4" },
      },
    },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});
