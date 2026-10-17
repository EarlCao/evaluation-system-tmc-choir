import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Link as RouterLink, useSearchParams } from "react-router";

import { ErrorState } from "@/components/ErrorState";
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

      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
        {filters.recipient ? (
          <Chip
            label={`About ${first ? personName(first.recipient) : "one member"}`}
            onDelete={() => {
              update("recipient", "");
            }}
          />
        ) : null}
        {filters.evaluator ? (
          <Chip
            label={`Written by ${first ? personName(first.evaluator) : "one member"}`}
            onDelete={() => {
              update("evaluator", "");
            }}
          />
        ) : null}
      </Stack>

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
          label="Criterion"
          value={filters.criterion ?? ""}
          onChange={(e) => {
            update("criterion", e.target.value);
          }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">Any criterion</MenuItem>
          {(criteria.data ?? []).map((c) => (
            <MenuItem key={c.public_id} value={c.public_id}>
              {c.current_version.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Rating from"
          type="number"
          value={filters.rating_min ?? ""}
          onChange={(e) => {
            update("rating_min", e.target.value);
          }}
          sx={{ width: 130 }}
        />
        <TextField
          label="Rating to"
          type="number"
          value={filters.rating_max ?? ""}
          error={Boolean(fieldError("rating_max"))}
          helperText={fieldError("rating_max")}
          onChange={(e) => {
            update("rating_max", e.target.value);
          }}
          sx={{ width: 130 }}
        />
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
        <TextField
          select
          label="Moderation"
          value={filters.moderation ?? ""}
          onChange={(e) => {
            update("moderation", e.target.value);
          }}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="">Any status</MenuItem>
          <MenuItem value="attention">Needs review</MenuItem>
          {(Object.keys(MODERATION_LABEL) as ModerationStatus[]).map((s) => (
            <MenuItem key={s} value={s}>
              {MODERATION_LABEL[s]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Edited"
          value={filters.edited ?? ""}
          onChange={(e) => {
            update("edited", e.target.value);
          }}
          sx={{ minWidth: 130 }}
        >
          <MenuItem value="">Either</MenuItem>
          <MenuItem value="true">Edited</MenuItem>
          <MenuItem value="false">Not edited</MenuItem>
        </TextField>
        {hasFilters ? (
          <Button
            onClick={() => {
              setParams(new URLSearchParams(), { replace: true });
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </Stack>

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
          />
          {pageCount(list.data.count) > 1 ? (
            <Pagination
              count={pageCount(list.data.count)}
              page={filters.page}
              onChange={(_, value) => {
                update("page", value > 1 ? String(value) : "");
              }}
              sx={{ alignSelf: "center" }}
            />
          ) : null}
        </>
      )}
    </Stack>
  );
}
