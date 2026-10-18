import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  badge?: string;
  children: ReactNode;
}

/** Centered luxury card used by the login, registration and password pages. */
export function AuthCard({ title, subtitle, badge, children }: AuthCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        mx: "auto",
        my: { xs: 3, md: 6 },
        maxWidth: 480,
        overflow: "hidden",
        position: "relative",
        backdropFilter: "blur(14px)",
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          height: 6,
          background: "linear-gradient(90deg, #1e1b4b 0%, #d4af37 50%, #0f766e 100%)",
        }}
      />
      <Stack spacing={3} sx={{ p: { xs: 3, md: 4.5 } }}>
        <div>
          {badge ? (
            <Chip
              label={badge}
              size="small"
              color="primary"
              variant="outlined"
              sx={{
                mb: 1.5,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontSize: "0.7rem",
              }}
            />
          ) : null}
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}
          >
            {title}
          </Typography>
          {subtitle ? <Typography color="text.secondary">{subtitle}</Typography> : null}
        </div>
        {children}
      </Stack>
    </Paper>
  );
}


