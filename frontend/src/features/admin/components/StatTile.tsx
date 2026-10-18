import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router";

interface StatTileProps {
  label: string;
  value: number | string;
  hint?: ReactNode;
  to?: string;
}

/** Dataviz stat tile: sentence-case label, proportional-figure value, optional hint/link. */
export function StatTile({ label, value, hint, to }: StatTileProps) {
  const content = (
    <CardContent sx={{ p: 2.5 }}>
      <Typography
        variant="body2"
        color="text.secondary"
        component="h2"
        sx={{ fontWeight: 600, mb: 0.5 }}
      >
        {label}
      </Typography>
      <Typography variant="h4" component="p" sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
        {value}
      </Typography>
      {hint ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {hint}
        </Typography>
      ) : null}
    </CardContent>
  );
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        overflow: "hidden",
        transition: "transform 120ms ease, box-shadow 120ms ease",
        "&:hover": to
          ? {
              transform: "translateY(-2px)",
              boxShadow: "0 8px 20px rgba(55, 48, 163, 0.08)",
            }
          : undefined,
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          height: 4,
          background: to
            ? "linear-gradient(90deg, #3730a3 0%, #0f766e 100%)"
            : "rgba(55, 48, 163, 0.25)",
        }}
      />
      {to ? (
        <CardActionArea component={RouterLink} to={to} sx={{ height: "100%" }}>
          {content}
        </CardActionArea>
      ) : (
        content
      )}
    </Card>
  );
}

