import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { createQueryClient } from "@/lib/queryClient";
import { createLuxuryTheme, ThemeModeContext, type ThemeMode } from "@/styles/theme";

const STORAGE_KEY = "tmc-color-mode";

function readInitialMode(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    // Ignore storage access errors in restricted environments
  }
  return "light";
}

interface AppProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

export function AppProviders({ children, queryClient }: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  const [mode, setModeState] = useState<ThemeMode>(readInitialMode);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore storage access errors
    }
  }, [mode]);

  const contextValue = useMemo(
    () => ({
      mode,
      setMode: (next: ThemeMode) => {
        setModeState(next);
      },
      toggleMode: () => {
        setModeState((prev) => (prev === "light" ? "dark" : "light"));
      },
    }),
    [mode],
  );

  const luxuryTheme = useMemo(() => createLuxuryTheme(mode), [mode]);

  return (
    <QueryClientProvider client={client}>
      <ThemeModeContext.Provider value={contextValue}>
        <ThemeProvider theme={luxuryTheme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </ThemeModeContext.Provider>
    </QueryClientProvider>
  );
}

