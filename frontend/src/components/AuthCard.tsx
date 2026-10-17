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
      sx={{ mx: "auto", my: { xs: 3, md: 6 }, p: { xs: 3, md: 4 }, maxWidth: 480 }}
    >
      <Stack spacing={3}>
        <div>
          <Typography variant="h4" component="h1" gutterBottom>
            {title}
          </Typography>
          {subtitle ? <Typography color="text.secondary">{subtitle}</Typography> : null}
        </div>
        {children}
      </Stack>
    </Paper>
  );
}
