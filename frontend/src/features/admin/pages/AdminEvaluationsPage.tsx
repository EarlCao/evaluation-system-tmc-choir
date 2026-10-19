import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Link as RouterLink, useSearchParams } from "react-router";

import { ErrorState } from "@/components/ErrorState";
import { ExportButtons } from "@/components/ExportButtons";
import { isApiError } from "@/lib/errors";
import { pageCount } from "@/lib/pagination";

import { EvaluationsTable, IdentityAccessNotice } from "../components/EvaluationsTable";
import { useCriteria, useCycles } from "../configQueries";
import { useAdminEvaluations } from "../moderationQueries";
import {
  MODERATION_LABEL,
  personName,
  type AdminEvaluationFilters,
  type ModerationStatus,
} from "../moderationTypes";
import { useAdminMembers } from "../queries";

const TEXT_FILTERS = [
  "recipient",
  "evaluator",
  "cycle",
  "criterion",
  "rating_min",
  "rating_max",
  "submitted_from",
  "submitted_to",
  "moderation",
  "edited",
  "evaluation_type",
] as const;

/** ADM-02 / ADM-03: every evaluation with its author, filterable; access is audited. */
export function AdminEvaluationsPage() {
  const [params, setParams] = useSearchParams();
  const filters: AdminEvaluationFilters = {
    page: Math.max(1, Number(params.get("page") ?? "1") || 1),
  };
  for (const key of TEXT_FILTERS) {
    const value = params.get(key);
    if (value) Object.assign(filters, { [key]: value });
  }
  const list = useAdminEvaluations(filters);
  const cycles = useCycles();
  const criteria = useCriteria(true);
  const members = useAdminMembers({ role: "MEMBER", pageSize: 100 });
  const memberList = members.data?.results ?? [];

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  }

  const first = list.data?.results[0];
  const fieldErrors = isApiError(list.error) ? list.error.fields : undefined;
  const fieldError = (key: string) => {
    const value = fieldErrors?.[key];
    return Array.isArray(value) ? value.join(" ") : undefined;
  };
  const hasFilters = TEXT_FILTERS.some((k) => params.get(k));

  return (
    <Stack spacing={3} sx={{ py: 4 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", gap: 2 }}
      >
        <Typography variant="h4" component="h1">
          All evaluations
        </Typography>
        <Button component={RouterLink} to="/admin/moderation" variant="outlined">
          Moderation queue
        </Button>
      </Stack>
      <IdentityAccessNotice />

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack spacing={2.5}>
          {/* Header: Title, quick type filters, and Clear all filters */}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            sx={{
              justifyContent: "space-between",
              alignItems: { xs: "flex-start", sm: "center" },
              gap: 1.5,
            }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
              <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
                Filter Evaluations
              </Typography>
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ flexWrap: "wrap", gap: 0.75 }}
                aria-label="Evaluation type quick filters"
              >
                <Chip
                  size="small"
                  label="All evaluations"
                  clickable
                  color={!filters.evaluation_type ? "primary" : "default"}
                  variant={!filters.evaluation_type ? "filled" : "outlined"}
                  onClick={() => update("evaluation_type", "")}
                />
                <Chip
                  size="small"
                  label="Member evaluations"
                  clickable
                  color={filters.evaluation_type === "peer" ? "primary" : "default"}
                  variant={filters.evaluation_type === "peer" ? "filled" : "outlined"}
                  onClick={() => update("evaluation_type", "peer")}
                />
                <Chip
                  size="small"
                  label="Self-evaluations"
                  clickable
                  color={filters.evaluation_type === "self" ? "primary" : "default"}
                  variant={filters.evaluation_type === "self" ? "filled" : "outlined"}
                  onClick={() => update("evaluation_type", "self")}
                />
              </Stack>
            </Stack>

            {hasFilters ? (
              <Button
                size="small"
                variant="contained"
                color="primary"
                onClick={() => {
                  setParams(new URLSearchParams(), { replace: true });
                }}
              >
                Clear all filters
              </Button>
            ) : (
              <Button size="small" variant="outlined" color="inherit" disabled>
                Clear all filters
              </Button>
            )}
          </Stack>

          {/* Active member filter tags if filtered by recipient or evaluator */}
          {filters.recipient || filters.evaluator ? (
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              {filters.recipient ? (
                <Chip
                  size="small"
                  color="primary"
                  variant="outlined"
                  label={`About ${memberList.find((m) => m.public_id === filters.recipient)?.display_name ?? (first ? personName(first.recipient) : "selected member")}`}
                  onDelete={() => {
                    update("recipient", "");
                  }}
                />
              ) : null}
              {filters.evaluator ? (
                <Chip
                  size="small"
                  color="primary"
                  variant="outlined"
                  label={`Written by ${memberList.find((m) => m.public_id === filters.evaluator)?.display_name ?? (first ? personName(first.evaluator) : "selected member")}`}
                  onDelete={() => {
                    update("evaluator", "");
                  }}
                />
              ) : null}
            </Stack>
          ) : null}

          {/* Organized grid of filter controls */}
          <Grid container spacing={2}>
            {/* Primary categorical filters */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Evaluation type"
                value={filters.evaluation_type ?? ""}
                onChange={(e) => {
                  update("evaluation_type", e.target.value);
                }}
              >
                <MenuItem value="">All evaluations</MenuItem>
                <MenuItem value="peer">Member evaluations</MenuItem>
                <MenuItem value="self">Self-evaluations</MenuItem>
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Period"
                value={filters.cycle ?? ""}
                onChange={(e) => {
                  update("cycle", e.target.value);
                }}
              >
                <MenuItem value="">All periods</MenuItem>
                {(cycles.data ?? []).map((c) => (
                  <MenuItem key={c.public_id} value={c.public_id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="About (Member)"
                value={filters.recipient ?? ""}
                onChange={(e) => {
                  update("recipient", e.target.value);
                }}
              >
                <MenuItem value="">All members (About)</MenuItem>
                {memberList.map((m) => (
                  <MenuItem key={m.public_id} value={m.public_id}>
                    {m.first_name} {m.last_name}{m.display_name && m.display_name !== `${m.first_name} ${m.last_name}` ? ` (${m.display_name})` : ""}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="From (Member)"
                value={filters.evaluator ?? ""}
                onChange={(e) => {
                  update("evaluator", e.target.value);
                }}
              >
                <MenuItem value="">All members (From)</MenuItem>
                {memberList.map((m) => (
                  <MenuItem key={m.public_id} value={m.public_id}>
                    {m.first_name} {m.last_name}{m.display_name && m.display_name !== `${m.first_name} ${m.last_name}` ? ` (${m.display_name})` : ""}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Criteria, rating range, and moderation */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Criterion"
                value={filters.criterion ?? ""}
                onChange={(e) => {
                  update("criterion", e.target.value);
                }}
              >
                <MenuItem value="">Any criterion</MenuItem>
                {(criteria.data ?? []).map((c) => (
                  <MenuItem key={c.public_id} value={c.public_id}>
                    {c.current_version.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  label="Rating from"
                  type="number"
                  value={filters.rating_min ?? ""}
                  onChange={(e) => {
                    update("rating_min", e.target.value);
                  }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Rating to"
                  type="number"
                  value={filters.rating_max ?? ""}
                  error={Boolean(fieldError("rating_max"))}
                  helperText={fieldError("rating_max")}
                  onChange={(e) => {
                    update("rating_max", e.target.value);
                  }}
                />
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Moderation"
                value={filters.moderation ?? ""}
                onChange={(e) => {
                  update("moderation", e.target.value);
                }}
              >
                <MenuItem value="">Any status</MenuItem>
                <MenuItem value="attention">Needs review</MenuItem>
                {(Object.keys(MODERATION_LABEL) as ModerationStatus[]).map((s) => (
                  <MenuItem key={s} value={s}>
                    {MODERATION_LABEL[s]}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Edited"
                value={filters.edited ?? ""}
                onChange={(e) => {
                  update("edited", e.target.value);
                }}
              >
                <MenuItem value="">Either</MenuItem>
                <MenuItem value="true">Edited</MenuItem>
                <MenuItem value="false">Not edited</MenuItem>
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, sm: 8, md: 6 }}>
              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  label="Submitted from"
                  type="date"
                  value={filters.submitted_from ?? ""}
                  onChange={(e) => {
                    update("submitted_from", e.target.value);
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  fullWidth
                  size="small"
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
            </Grid>
          </Grid>
        </Stack>
      </Paper>

      <ExportButtons
        report="evaluations"
        filters={Object.fromEntries(TEXT_FILTERS.map((k) => [k, params.get(k) ?? ""]))}
        types={["csv", "xlsx"]}
        identities
      />

      {list.isError ? (
        fieldErrors ? (
          <Typography color="error">Check the filters above.</Typography>
        ) : (
          <ErrorState
            message="We couldn't load the evaluations."
            onRetry={() => void list.refetch()}
          />
        )
      ) : list.isPending ? (
        <Skeleton variant="rounded" height={240} />
      ) : list.data.results.length === 0 ? (
        <Typography color="text.secondary">No evaluations match these filters.</Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" role="status">
            {list.data.count} {list.data.count === 1 ? "evaluation" : "evaluations"}
          </Typography>
          <EvaluationsTable
            rows={list.data.results}
            label="Evaluations"
            dimmed={list.isPlaceholderData}
            selectedCriterion={filters.criterion}
            currentSearch={params.toString()}
          />
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{
              justifyContent: "space-between",
              alignItems: "center",
              pt: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Page {filters.page} of {Math.max(1, pageCount(list.data.count))}
            </Typography>
            <Pagination
              count={Math.max(1, pageCount(list.data.count))}
              page={filters.page}
              onChange={(_, value) => {
                update("page", value > 1 ? String(value) : "");
              }}
              color="primary"
            />
          </Stack>
        </>
      )}
    </Stack>
  );
}
