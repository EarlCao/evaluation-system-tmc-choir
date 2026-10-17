import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { Link as RouterLink } from "react-router";

import { ErrorState } from "@/components/ErrorState";
import { FullPageSpinner } from "@/components/FullPageSpinner";

import { useCycles } from "../configQueries";
import { CYCLE_STATUS_LABEL, type CycleStatus } from "../configTypes";

export function CycleStatusChip({ status }: { status: CycleStatus }) {
  const color = { DRAFT: "default", OPEN: "success", CLOSED: "info", ARCHIVED: "default" } as const;
  return (
    <Chip
      size="small"
      variant="outlined"
      color={color[status]}
      label={CYCLE_STATUS_LABEL[status]}
    />
  );
}

/** EVAL-06 / CFG-05: evaluation periods. */
export function AdminCyclesPage() {
  const cycles = useCycles();
  if (cycles.isPending) return <FullPageSpinner label="Loading periods" />;
  if (cycles.isError)
    return (
      <ErrorState message="We couldn't load the periods." onRetry={() => void cycles.refetch()} />
    );
  return (
    <Stack spacing={3} sx={{ py: 4 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", gap: 2 }}
      >
        <Typography variant="h4" component="h1">
          Evaluation periods
        </Typography>
        <Button component={RouterLink} to="/admin/cycles/new" variant="contained">
          New period
        </Button>
      </Stack>
      {cycles.data.length === 0 ? (
        <Typography color="text.secondary">
          No periods yet. Create one, choose a published form and open it.
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Evaluation periods">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Dates</TableCell>
                <TableCell>Form</TableCell>
                <TableCell>Who evaluates whom</TableCell>
                <TableCell>Feedback shown</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cycles.data.map((c) => (
                <TableRow key={c.public_id} hover>
                  <TableCell>
                    <Link component={RouterLink} to={`/admin/cycles/${c.public_id}`}>
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <CycleStatusChip status={c.status} />
                  </TableCell>
                  <TableCell>
                    {new Date(c.starts_at).toLocaleDateString()} –{" "}
                    {new Date(c.ends_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {c.form_version
                      ? `v${String(c.form_version.version)} ${c.form_version.title}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {c.evaluation_scope === "ALL" ? "Everyone" : "Same section"}
                  </TableCell>
                  <TableCell>
                    {c.feedback_visibility === "IMMEDIATE" ? "Immediately" : "After closing"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
