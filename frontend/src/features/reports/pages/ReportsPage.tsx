import Grid from "@mui/material/Grid";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Link as RouterLink, useSearchParams } from "react-router";

import { ErrorState } from "@/components/ErrorState";
import { ExportButtons } from "@/components/ExportButtons";
import { Meter } from "@/components/Meter";
import { useCriteria, useCycles } from "@/features/admin";
import { useVoiceSections } from "@/features/auth";
import { isApiError } from "@/lib/errors";

import {
  CriteriaTable,
  Explanations,
  PercentCell,
  Section,
  TrendTable,
} from "../components/ReportTables";
import { useChoirSummary, useParticipation } from "../queries";
import type { ReportFilters } from "../types";

const CHOIR_FILTERS = [
  "cycle",
  "voice_section",
  "criterion",
  "submitted_from",
  "submitted_to",
] as const;

function useParamUpdater() {
  const [params, setParams] = useSearchParams();
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  return { params, update };
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary" component="h3">
        {label}
      </Typography>
      <Typography variant="h5" component="p" sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
    </Paper>
  );
}

function ChoirReport() {
  const { params, update } = useParamUpdater();
  const filters: ReportFilters = {};
  for (const key of CHOIR_FILTERS) {
    const value = params.get(key);
    if (value) filters[key] = value;
  }
  const summary = useChoirSummary(filters);
  const cycles = useCycles();
  const criteria = useCriteria(true);
  const sections = useVoiceSections();
  const fields = isApiError(summary.error) ? summary.error.fields : undefined;
  const fieldError = (key: string) => {
    const value = fields?.[key];
    return Array.isArray(value) ? value.join(" ") : undefined;
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ flexWrap: "wrap" }}>
        <TextField
          select
          label="Period"
          value={filters.cycle ?? ""}
          onChange={(e) => {
            update("cycle", e.target.value);
          }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">All periods</MenuItem>
          {(cycles.data ?? []).map((c) => (
            <MenuItem key={c.public_id} value={c.public_id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Voice section"
          value={filters.voice_section ?? ""}
          onChange={(e) => {
            update("voice_section", e.target.value);
          }}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">All sections</MenuItem>
          {(sections.data ?? []).map((s) => (
            <MenuItem key={s.id} value={String(s.id)}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Criterion"
          value={filters.criterion ?? ""}
          onChange={(e) => {
            update("criterion", e.target.value);
          }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">All criteria</MenuItem>
          {(criteria.data ?? []).map((c) => (
            <MenuItem key={c.public_id} value={c.public_id}>
              {c.current_version.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Submitted from"
          type="date"
          value={filters.submitted_from ?? ""}
          onChange={(e) => {
            update("submitted_from", e.target.value);
          }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="Submitted to"
          type="date"
          value={filters.submitted_to ?? ""}
          error={Boolean(fieldError("submitted_to"))}
          helperText={fieldError("submitted_to")}
          onChange={(e) => {
            update("submitted_to", e.target.value);
          }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Stack>
      <ExportButtons report="choir" filters={filters} />

      {summary.isError ? (
        fields ? (
          <Typography color="error">Check the filters above.</Typography>
        ) : (
          <ErrorState
            message="We couldn't load the report."
            onRetry={() => void summary.refetch()}
          />
        )
      ) : summary.isPending ? (
        <Skeleton variant="rounded" height={240} />
      ) : (
        <Stack spacing={3} sx={{ opacity: summary.isPlaceholderData ? 0.6 : 1 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatBox label="Evaluations" value={summary.data.totals.evaluations} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatBox label="Members who evaluated" value={summary.data.totals.evaluators} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatBox label="Members evaluated" value={summary.data.totals.recipients} />
            </Grid>
          </Grid>
          <Section title="Criteria">
            <CriteriaTable criteria={summary.data.criteria} />
          </Section>
          <Section
            title="Voice sections"
            note={`By the section of the member evaluated. Sections with fewer than ${String(summary.data.threshold)} evaluators are hidden.`}
          >
            {summary.data.voice_sections.length === 0 ? (
              <Typography color="text.secondary">No evaluations yet.</Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" aria-label="Voice sections">
                  <TableHead>
                    <TableRow>
                      <TableCell>Voice section</TableCell>
                      <TableCell align="right">Evaluations</TableCell>
                      <TableCell align="right">Members evaluated</TableCell>
                      <TableCell>Average position on the scale</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {summary.data.voice_sections.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.name}</TableCell>
                        <TableCell align="right">{s.evaluations}</TableCell>
                        <TableCell align="right">{s.recipients}</TableCell>
                        <TableCell>
                          {s.suppressed ? (
                            "Hidden: too few"
                          ) : (
                            <PercentCell label={`${s.name} average`} value={s.average_percent} />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Section>
          <Section title="By period">
            <TrendTable trend={summary.data.trend} />
          </Section>
          <Explanations threshold={summary.data.threshold} />
        </Stack>
      )}
    </Stack>
  );
}

function ParticipationTab() {
  const { params, update } = useParamUpdater();
  const cycles = useCycles();
  const fallback =
    cycles.data?.find((c) => c.status === "OPEN")?.public_id ?? cycles.data?.[0]?.public_id ?? "";
  const cycle = params.get("cycle") ?? fallback;
  const report = useParticipation(cycle);

  if (cycles.isPending) return <Skeleton variant="rounded" height={200} />;
  if (!cycle) return <Typography color="text.secondary">No evaluation periods yet.</Typography>;
  return (
    <Stack spacing={3}>
      <TextField
        select
        label="Period"
        value={cycle}
        onChange={(e) => {
          update("cycle", e.target.value);
        }}
        sx={{ maxWidth: 320 }}
      >
        {(cycles.data ?? []).map((c) => (
          <MenuItem key={c.public_id} value={c.public_id}>
            {c.name}
          </MenuItem>
        ))}
      </TextField>
      <ExportButtons report="participation" filters={{ cycle }} identities />
      {report.isError ? (
        <ErrorState message="We couldn't load the report." onRetry={() => void report.refetch()} />
      ) : report.isPending ? (
        <Skeleton variant="rounded" height={240} />
      ) : (
        <Stack spacing={2} sx={{ opacity: report.isPlaceholderData ? 0.6 : 1 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Typography>
                {report.data.totals.submitted_pairs} of {report.data.totals.possible_pairs} possible
                evaluations · {report.data.totals.participating_members} members took part
              </Typography>
              {report.data.totals.participation_percent === null ? (
                <Typography variant="body2" color="text.secondary">
                  Nobody can evaluate anyone in this period.
                </Typography>
              ) : (
                <PercentCell
                  label="Participation"
                  value={report.data.totals.participation_percent}
                />
              )}
              <Typography variant="body2" color="text.secondary">
                Possible = the active members each person may evaluate in this period (
                {report.data.cycle.evaluation_scope === "ALL" ? "everyone" : "their own section"},
                themselves excluded). Resubmissions count once. Super Admins don't evaluate.
              </Typography>
            </Stack>
          </Paper>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small" aria-label="Participation by member">
              <TableHead>
                <TableRow>
                  <TableCell>Member</TableCell>
                  <TableCell>Voice section</TableCell>
                  <TableCell>Evaluations given</TableCell>
                  <TableCell align="right">Received</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.data.members.map((m) => (
                  <TableRow key={m.public_id}>
                    <TableCell>
                      <Link component={RouterLink} to={`/admin/reports/members/${m.public_id}`}>
                        {m.first_name} {m.last_name}
                      </Link>
                    </TableCell>
                    <TableCell>{m.voice_section}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Typography variant="body2" sx={{ minWidth: 48 }}>
                          {m.given} / {m.possible}
                        </Typography>
                        {m.possible > 0 ? (
                          <Stack sx={{ width: 100 }}>
                            <Meter
                              label={`${m.first_name} ${m.last_name} evaluations given`}
                              value={m.given}
                              min={0}
                              max={m.possible}
                              valueText={`${String(m.given)} of ${String(m.possible)}`}
                            />
                          </Stack>
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{m.received}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      )}
    </Stack>
  );
}

/** REP-01..06 / ADM-07: choir-wide and participation reports with exports. */
export function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "participation" ? "participation" : "choir";
  return (
    <Stack spacing={3} sx={{ py: 4 }}>
      <Typography variant="h4" component="h1">
        Reports
      </Typography>
      <Tabs
        value={view}
        onChange={(_, next: string) => {
          setParams(next === "choir" ? {} : { view: next }, { replace: true });
        }}
        aria-label="Report"
      >
        <Tab value="choir" label="Choir summary" />
        <Tab value="participation" label="Participation" />
      </Tabs>
      {view === "choir" ? <ChoirReport /> : <ParticipationTab />}
    </Stack>
  );
}
