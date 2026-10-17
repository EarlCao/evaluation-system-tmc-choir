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
    <CardContent>
      <Typography variant="body2" color="text.secondary" component="h2">
        {label}
      </Typography>
      <Typography variant="h4" component="p" sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
      {hint ? (
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
      ) : null}
    </CardContent>
  );
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
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
