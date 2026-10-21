import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Fragment, useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import { ErrorState } from "@/components/ErrorState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatDateTime } from "@/lib/datetime";
import { flattenFieldErrors, isApiError } from "@/lib/errors";
import { pageCount } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

import { auditExportUrl } from "../systemApi";
import {
  useAuditEventTypes,
  useAuditLogs,
  useClearAuditLogs,
  useDeleteAuditLog,
} from "../systemQueries";
import type { AuditEntry, AuditFilters } from "../systemTypes";

const FILTER_KEYS = ["event_type", "actor", "occurred_from", "occurred_to"] as const;

function Json({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && Object.keys(value).length === 0) return null;
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Paper
        component="pre"
        variant="outlined"
        sx={{ m: 0, p: 1, fontSize: 12, overflowX: "auto", whiteSpace: "pre-wrap" }}
      >
        {JSON.stringify(value, null, 2)}
      </Paper>
    </Stack>
  );
}

function EntryRow({
  entry,
  onDelete,
}: {
  entry: AuditEntry;
  onDelete: (entry: AuditEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Fragment>
      <TableRow hover>
        <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(entry.occurred_at)}</TableCell>
        <TableCell>
          <code>{entry.event_type}</code>
        </TableCell>
        <TableCell>
          {entry.actor ? entry.actor.name || entry.actor.username : "System / anonymous"}
          {entry.actor_role ? (
            <Typography variant="caption" color="text.secondary" component="div">
              {entry.actor_role === "SUPER_ADMIN" ? "Super Admin" : "Member"}
            </Typography>
          ) : null}
        </TableCell>
        <TableCell>
          {entry.target_type ? (
            <>
              {entry.target_type}
              <Typography variant="caption" color="text.secondary" component="div">
                {entry.target_id}
              </Typography>
            </>
          ) : (
            "—"
          )}
        </TableCell>
        <TableCell>{entry.ip_address ?? "—"}</TableCell>
        <TableCell sx={{ whiteSpace: "nowrap" }}>
          <Button
            size="small"
            aria-expanded={open}
            aria-label={`${open ? "Hide" : "Show"} details of entry ${String(entry.id)}`}
            onClick={() => {
              setOpen((v) => !v);
            }}
          >
            {open ? "Hide" : "Details"}
          </Button>
          {!["audit.entry.deleted", "audit.logs.cleared"].includes(entry.event_type) ? (
            <Button
              size="small"
              color="error"
              aria-label={`Delete entry ${String(entry.id)}`}
              onClick={() => {
                onDelete(entry);
              }}
            >
              Delete
            </Button>
          ) : null}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={6} sx={{ py: 0, borderBottom: open ? undefined : "none" }}>
          <Collapse in={open} unmountOnExit>
            <Stack spacing={1} sx={{ py: 2 }}>
              <Json label="Before" value={entry.before} />
              <Json label="After" value={entry.after} />
              <Json label="Details" value={entry.metadata} />
              <Typography variant="caption" color="text.secondary">
                Request {entry.request_id || "—"} · {entry.user_agent || "no user agent"}
              </Typography>
            </Stack>
          </Collapse>
        </TableCell>
      </TableRow>
    </Fragment>
  );
}

/** AUD-03 / AUD-04: guarded audit deletion, filters and audited exports (ADR-022). */
export function AdminAuditPage() {
  const [params, setParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(params.get("search") ?? "");
  const search = useDebouncedValue(searchInput.trim());
  const filters: AuditFilters = {
    search,
    page: Math.max(1, Number(params.get("page") ?? "1") || 1),
  };
  for (const key of FILTER_KEYS) {
    const value = params.get(key);
    if (value) filters[key] = value;
  }
  const logs = useAuditLogs(filters);
  const eventTypes = useAuditEventTypes();
  const deleteLog = useDeleteAuditLog();
  const clearLogs = useClearAuditLogs();
  const [target, setTarget] = useState<AuditEntry | "all" | null>(null);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [success, setSuccess] = useState("");
  const mutation = target === "all" ? clearLogs : deleteLog;
  const pending = deleteLog.isPending || clearLogs.isPending;
  const deletionFields = isApiError(mutation.error)
    ? flattenFieldErrors(mutation.error.fields)
    : {};

  function closeDeletion() {
    if (pending) return;
    setTarget(null);
    setPassword("");
    setReason("");
    setConfirmation("");
    deleteLog.reset();
    clearLogs.reset();
  }

  async function confirmDeletion() {
    if (target === null || pending) return;
    try {
      const input = { password, reason, confirmation };
      const result =
        target === "all"
          ? await clearLogs.mutateAsync(input)
          : await deleteLog.mutateAsync({ ...input, id: target.id });
      setSuccess(
        `${String(result.deleted)} audit ${result.deleted === 1 ? "entry deleted" : "entries deleted"}. Deletion receipts are retained.`,
      );
      if (target === "all") {
        setSearchInput("");
        setParams({});
      } else {
        update("page", "");
      }
      // mutateAsync has completed; discard password and all dialog state immediately.
      setTarget(null);
      setPassword("");
      setReason("");
      setConfirmation("");
      deleteLog.reset();
      clearLogs.reset();
    } catch {
      // Mutation error stays in the dialog; never report success on a rejected request.
      setPassword("");
    }
  }

  const urlSearch = params.get("search") ?? "";
  useEffect(() => {
    if (search === urlSearch) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (search) next.set("search", search);
        else next.delete("search");
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  }, [search, urlSearch, setParams]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  }

  const fields = isApiError(logs.error) ? logs.error.fields : undefined;
  const dateError = Array.isArray(fields?.occurred_to) ? fields.occurred_to.join(" ") : undefined;
  const firstActor = logs.data?.results[0]?.actor;

  return (
    <Stack spacing={3} sx={{ py: 4 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, gap: 2 }}
      >
        <Typography variant="h4" component="h1">
          Audit log
        </Typography>
        <Button
          color="error"
          variant="outlined"
          onClick={() => {
            setSuccess("");
            setTarget("all");
          }}
        >
          Clear all logs
        </Button>
      </Stack>
      <Typography color="text.secondary">
        Every sign-in, account change, evaluation, setting change, moderation decision, export and
        view of evaluator identities.
      </Typography>
      {success ? <Alert severity="success">{success}</Alert> : null}

      {filters.actor ? (
        <Stack direction="row">
          <Chip
            label={`By ${firstActor ? firstActor.name || firstActor.username : "one person"}`}
            onDelete={() => {
              update("actor", "");
            }}
          />
        </Stack>
      ) : null}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ flexWrap: "wrap" }}>
        <TextField
          label="Search event, target id, IP or request id"
          type="search"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
          }}
          sx={{ flex: 2, minWidth: 240 }}
        />
        <TextField
          select
          label="Event"
          value={filters.event_type ?? ""}
          onChange={(e) => {
            update("event_type", e.target.value);
          }}
          sx={{ flex: 1, minWidth: 240 }}
        >
          <MenuItem value="">All events</MenuItem>
          {(eventTypes.data ?? []).map((t) => (
            <MenuItem key={t} value={t}>
              {t}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="From"
          type="date"
          value={filters.occurred_from ?? ""}
          onChange={(e) => {
            update("occurred_from", e.target.value);
          }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="To"
          type="date"
          value={filters.occurred_to ?? ""}
          error={Boolean(dateError)}
          helperText={dateError}
          onChange={(e) => {
            update("occurred_to", e.target.value);
          }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Stack>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="body2" color="text.secondary">
          Export:
        </Typography>
        <Button size="small" variant="outlined" href={auditExportUrl("csv", filters)} download>
          CSV
        </Button>
        <Button size="small" variant="outlined" href={auditExportUrl("xlsx", filters)} download>
          Excel
        </Button>
        <Typography variant="caption" color="text.secondary">
          Times are UTC in exports. The export is itself recorded.
        </Typography>
      </Stack>

      {logs.isError ? (
        fields ? (
          <Typography color="error">Check the filters above.</Typography>
        ) : (
          <ErrorState
            message="We couldn't load the audit log."
            onRetry={() => void logs.refetch()}
          />
        )
      ) : logs.isPending ? (
        <Skeleton variant="rounded" height={240} />
      ) : logs.data.results.length === 0 ? (
        <Typography color="text.secondary">No entries match these filters.</Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" role="status">
            {logs.data.count} {logs.data.count === 1 ? "entry" : "entries"}
          </Typography>
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ opacity: logs.isPlaceholderData ? 0.6 : 1 }}
          >
            <Table size="small" aria-label="Audit log">
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Event</TableCell>
                  <TableCell>By</TableCell>
                  <TableCell>Target</TableCell>
                  <TableCell>IP address</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.data.results.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    onDelete={(entry) => {
                      setSuccess("");
                      setTarget(entry);
                    }}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {pageCount(logs.data.count) > 1 ? (
            <Pagination
              count={pageCount(logs.data.count)}
              page={filters.page}
              onChange={(_, value) => {
                update("page", value > 1 ? String(value) : "");
              }}
              sx={{ alignSelf: "center" }}
            />
          ) : null}
        </>
      )}
      <ConfirmDialog
        open={target !== null}
        title={target === "all" ? "Clear all audit logs?" : "Delete this audit entry?"}
        description={
          target === "all"
            ? "This permanently deletes all ordinary audit entries, including entries outside the current filters. Deletion receipts are retained. Export or back up first; recovery requires an existing backup."
            : "This permanently deletes the selected audit entry and keeps a deletion receipt. Recovery requires an existing backup."
        }
        confirmLabel={target === "all" ? "Clear all logs" : "Delete entry"}
        destructive
        pending={pending}
        confirmDisabled={
          !password || !reason.trim() || (target === "all" && confirmation !== "DELETE ALL LOGS")
        }
        onClose={closeDeletion}
        onConfirm={() => void confirmDeletion()}
      >
        <Stack spacing={2} sx={{ mt: 2 }}>
          {mutation.isError ? (
            <Alert severity="error">
              {Object.values(deletionFields).join(" ") ||
                (mutation.error instanceof Error
                  ? mutation.error.message
                  : "Deletion failed. Please try again.")}
            </Alert>
          ) : null}
          <TextField
            label="Reason for deletion"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
            disabled={pending}
            required
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          <TextField
            label="Your password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            disabled={pending}
            required
          />
          {target === "all" ? (
            <TextField
              label="Type DELETE ALL LOGS"
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value);
              }}
              disabled={pending}
              required
              autoComplete="off"
            />
          ) : null}
        </Stack>
      </ConfirmDialog>
    </Stack>
  );
}
