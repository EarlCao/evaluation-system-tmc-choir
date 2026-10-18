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
  showLogo?: boolean;
  children: ReactNode;
}

/** Centered luxury card used by the login, registration and password pages. */
export function AuthCard({ title, subtitle, badge, showLogo = true, children }: AuthCardProps) {
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
          {showLogo ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                mb: 2.5,
              }}
            >
              <Box
                component="img"
                src="/logo.png"
                alt="Alon Himig Logo"
                sx={{
                  width: { xs: 52, sm: 60 },
                  height: { xs: 52, sm: 60 },
                  objectFit: "contain",
                  borderRadius: 2,
                  filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.18))",
                }}
              />
              <Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    lineHeight: 1.2,
                    fontSize: { xs: "1.05rem", sm: "1.2rem" },
                  }}
                >
                  ALON HIMIG
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: "block",
                    fontWeight: 600,
                    letterSpacing: "0.03em",
                    textTransform: "uppercase",
                    fontSize: "0.72rem",
                  }}
                >
                  Choir Member Evaluation System
                </Typography>
              </Box>
            </Box>
          ) : null}
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


