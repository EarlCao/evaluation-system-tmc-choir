import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
  type TooltipValueType,
} from "recharts";

import type { TrendPoint } from "../types";
import { vizVars } from "../vizTokens";

interface Row {
  name: string;
  value: number | null;
  evaluations: number;
}

function TrendTooltip({ active, payload }: TooltipContentProps<TooltipValueType, string | number>) {
  const row = payload[0]?.payload as Row | undefined;
  if (!active || !row) return null;
  return (
    <Paper variant="outlined" sx={{ px: 1.5, py: 1 }}>
      {/* Values lead, labels follow (dataviz interaction rules). */}
      <Typography variant="subtitle2" component="p">
        {row.value === null ? "Not enough evaluations" : `${row.value.toFixed(0)}%`}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {row.name} · {row.evaluations} {row.evaluations === 1 ? "evaluation" : "evaluations"}
      </Typography>
    </Paper>
  );
}

/**
 * REP-02 trend: one series over evaluation periods (2px line, ringed 8px markers, solid
 * hairline grid, one y-axis 0-100 %, crosshair tooltip). Suppressed periods are gaps, never
 * zeros. A table view carries every value without hovering (WCAG twin).
 */
export function TrendChart({ trend }: { trend: TrendPoint[] }) {
  const rows: Row[] = trend.map((t) => ({
    name: t.cycle.name,
    value: t.suppressed ? null : t.average_percent,
    evaluations: t.evaluations,
  }));
  const lastIndex = rows.reduce((last, r, i) => (r.value === null ? last : i), -1);
  const shown = rows.filter((r) => r.value !== null);
  const description =
    shown.length === 0
      ? "No period has enough evaluations to show an average yet."
      : `Average rating as a percentage of the scale for ${String(shown.length)} evaluation period(s).`;

  return (
    <Box sx={(theme) => vizVars(theme)}>
      <Box role="img" aria-label={description} sx={{ width: "100%" }}>
        <ResponsiveContainer
          width="100%"
          height={260}
          initialDimension={{ width: 600, height: 260 }}
        >
          <LineChart data={rows} margin={{ top: 16, right: 48, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="var(--viz-grid)" strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="name"
              padding={{ left: 32, right: 32 }}
              interval="preserveStartEnd"
              stroke="var(--viz-axis)"
              tick={{ fill: "var(--viz-muted)", fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v: number) => `${String(v)}%`}
              stroke="var(--viz-axis)"
              tick={{ fill: "var(--viz-muted)", fontSize: 12 }}
              tickLine={false}
              width={48}
            />
            <Tooltip
              content={(props) => <TrendTooltip {...props} />}
              cursor={{ stroke: "var(--viz-axis)", strokeWidth: 1 }}
            />
            <Line
              type="linear"
              dataKey="value"
              stroke="var(--viz-series)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              connectNulls={false}
              isAnimationActive={false}
              dot={{
                r: 4,
                fill: "var(--viz-series)",
                stroke: "var(--viz-surface)",
                strokeWidth: 2,
              }}
              activeDot={{
                r: 5,
                fill: "var(--viz-series)",
                stroke: "var(--viz-surface)",
                strokeWidth: 2,
              }}
              label={(props: {
                index?: number;
                x?: number | string;
                y?: number | string;
                value?: unknown;
              }) =>
                props.index === lastIndex && typeof props.value === "number" ? (
                  <text
                    x={Number(props.x) + 8}
                    y={Number(props.y)}
                    dy={4}
                    fontSize={12}
                    fill="var(--viz-muted)"
                  >
                    {`${props.value.toFixed(0)}%`}
                  </text>
                ) : (
                  <g />
                )
              }
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
      <details>
        <summary>Show as a table</summary>
        <Table size="small" aria-label="Average rating per evaluation period">
          <TableHead>
            <TableRow>
              <TableCell>Evaluation period</TableCell>
              <TableCell align="right">Evaluations</TableCell>
              <TableCell align="right">Average (% of scale)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.name}>
                <TableCell>{r.name}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {r.evaluations}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {r.value === null ? "Not enough evaluations" : `${r.value.toFixed(0)}%`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </details>
    </Box>
  );
}
