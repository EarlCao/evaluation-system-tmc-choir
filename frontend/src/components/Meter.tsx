import Box from "@mui/material/Box";

import { vizVars } from "@/lib/vizTokens";

interface MeterProps {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Spoken value, e.g. "4.1 out of 5". The visible text must say the same thing. */
  valueText: string;
}

/**
 * A single ratio against its range (dataviz "meter"): one-ramp fill on a lighter track of the same
 * hue. Always paired with the value as visible text, so it never carries meaning by color/length alone.
 */
export function Meter({ label, value, min, max, valueText }: MeterProps) {
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <Box
      role="meter"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      sx={(theme) => ({
        ...vizVars(theme),
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
  );
}
