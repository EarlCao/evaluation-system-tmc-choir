import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

import { Meter } from "@/components/Meter";

import type { CriterionAggregate, ReportTrendPoint } from "../types";

const HIDDEN = "Hidden: too few";

function average(c: CriterionAggregate): string {
  if (c.average === null) return "—";
  return c.scale.type === "PERCENT"
    ? `${String(c.average)}%`
    : `${String(c.average)} / ${String(c.scale.max)}`;
}

/** Average position on the scale, as a meter with the same value in text (dataviz meter). */
export function PercentCell({ label, value }: { label: string; value: number | null }) {
  if (value === null) return <>—</>;
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 140 }}>
      <Box sx={{ flex: 1 }}>
        <Meter label={label} value={value} min={0} max={100} valueText={`${String(value)}%`} />
      </Box>
      <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
        {value}%
      </Typography>
    </Stack>
  );
}

export function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Stack spacing={1}>
      <Typography variant="h6" component="h2">
        {title}
      </Typography>
      {note ? (
        <Typography variant="body2" color="text.secondary">
          {note}
        </Typography>
      ) : null}
      {children}
    </Stack>
  );
}

export function CriteriaTable({ criteria }: { criteria: CriterionAggregate[] }) {
  if (criteria.length === 0) return <Typography color="text.secondary">No ratings yet.</Typography>;
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label="Criteria">
        <TableHead>
          <TableRow>
            <TableCell>Criterion</TableCell>
            <TableCell align="right">Rated</TableCell>
            <TableCell align="right">Not rated</TableCell>
            <TableCell>Average</TableCell>
            <TableCell>Position on the scale</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {criteria.map((c) => (
            <TableRow key={`${c.criterion_public_id}-${String(c.version)}`}>
              <TableCell>
                {c.criterion}{" "}
                <Typography component="span" variant="caption" color="text.secondary">
                  v{c.version} · {c.scale.min}–{c.scale.max}
                </Typography>
              </TableCell>
              <TableCell align="right">{c.rated}</TableCell>
              <TableCell align="right">{c.not_rated}</TableCell>
              <TableCell>{c.suppressed ? HIDDEN : average(c)}</TableCell>
              <TableCell>
                {c.suppressed ? (
                  HIDDEN
                ) : (
                  <PercentCell
                    label={`${c.criterion} position on the scale`}
                    value={c.average_percent}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function TrendTable({ trend }: { trend: ReportTrendPoint[] }) {
  if (trend.length === 0) return <Typography color="text.secondary">No periods yet.</Typography>;
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label="By period">
        <TableHead>
          <TableRow>
            <TableCell>Period</TableCell>
            <TableCell align="right">Evaluations</TableCell>
            <TableCell align="right">Evaluators</TableCell>
            <TableCell>Average position on the scale</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {trend.map((t) => (
            <TableRow key={t.cycle.public_id}>
              <TableCell>{t.cycle.name}</TableCell>
              <TableCell align="right">{t.evaluations}</TableCell>
              <TableCell align="right">{t.evaluators}</TableCell>
              <TableCell>
                {t.suppressed ? (
                  HIDDEN
                ) : (
                  <PercentCell label={`${t.cycle.name} average`} value={t.average_percent} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function Explanations({ threshold }: { threshold?: number }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" component="h2" gutterBottom>
        How these numbers work
      </Typography>
      <Stack component="ul" spacing={0.5} sx={{ pl: 2, m: 0 }}>
        <Typography component="li" variant="body2">
          Averages use only the ratings that were given. “Not rated” is counted separately and never
          as zero.
        </Typography>
        <Typography component="li" variant="body2">
          “Position on the scale” puts every criterion on 0–100% (lowest to highest point), so
          criteria with different scales can be compared.
        </Typography>
        <Typography component="li" variant="body2">
          When a criterion's scale changes it gets a new version, reported separately.
        </Typography>
        {threshold ? (
          <Typography component="li" variant="body2">
            Figures based on fewer than {threshold} members are hidden so nobody can work out who
            gave a rating (privacy threshold, set in System settings).
          </Typography>
        ) : null}
        <Typography component="li" variant="body2">
          Evaluations hidden by moderation are left out.
        </Typography>
      </Stack>
    </Paper>
  );
}
