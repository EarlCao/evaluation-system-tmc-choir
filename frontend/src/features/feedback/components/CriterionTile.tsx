import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";

import type { CriterionSummary } from "../types";
import { vizVars } from "../vizTokens";

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Stat tile per criterion (dataviz: a single value is a tile, not a chart). The meter shows
 * where the average sits on the criterion's own scale; the value is always written as text,
 * so the bar never carries meaning alone. Suppressed below the privacy threshold (BR-16).
 */
export function CriterionTile({
  summary,
  threshold,
}: {
  summary: CriterionSummary;
  threshold: number;
}) {
  const { scale } = summary;
  const percent =
    summary.average === null ? 0 : ((summary.average - scale.min) / (scale.max - scale.min)) * 100;

  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary" component="h3">
          {summary.criterion}
        </Typography>
        {summary.suppressed || summary.average === null ? (
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Not enough evaluations yet to show an average (shown from {threshold}).
          </Typography>
        ) : (
          <>
            <Typography variant="h4" component="p" sx={{ fontWeight: 600 }}>
              {fmt(summary.average)}
              <Typography component="span" variant="body1" color="text.secondary">
                {" "}
                / {fmt(scale.max)}
              </Typography>
            </Typography>
            <Box
              role="meter"
              aria-label={`${summary.criterion} average`}
              aria-valuemin={scale.min}
              aria-valuemax={scale.max}
              aria-valuenow={summary.average}
              aria-valuetext={`${fmt(summary.average)} out of ${fmt(scale.max)}`}
              sx={(theme) => ({
                ...vizVars(theme),
                mt: 1,
                height: 8,
                borderRadius: "4px",
                bgcolor: "var(--viz-track)",
                overflow: "hidden",
              })}
            >
              <Box
                sx={{
                  width: `${String(Math.max(0, Math.min(100, percent)))}%`,
                  height: "100%",
                  bgcolor: "var(--viz-series)",
                  borderRadius: "4px",
                }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Average of {summary.n} {summary.n === 1 ? "rating" : "ratings"}
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  );
}
