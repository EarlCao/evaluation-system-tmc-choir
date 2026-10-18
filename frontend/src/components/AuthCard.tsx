import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Centered card used by the login, registration and password pages. */
export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        mx: "auto",
        my: { xs: 3, md: 6 },
        maxWidth: 480,
        overflow: "hidden",
        boxShadow: "0 12px 32px rgba(15, 23, 42, 0.06)",
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          height: 6,
          background: "linear-gradient(90deg, #3730a3 0%, #0f766e 100%)",
        }}
      />
      <Stack spacing={3} sx={{ p: { xs: 3, md: 4 } }}>
        <div>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 800 }}>
            {title}
          </Typography>
          {subtitle ? <Typography color="text.secondary">{subtitle}</Typography> : null}
        </div>
        {children}
      </Stack>
    </Paper>
  );
}

