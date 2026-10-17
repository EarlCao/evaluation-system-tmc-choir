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
import { formatDateTime } from "@/lib/datetime";

import { useForms } from "../configQueries";

/** CFG-04 / CFG-06: form versions. Published versions are frozen; cycles use one each. */
export function AdminFormsPage() {
  const forms = useForms();
  if (forms.isPending) return <FullPageSpinner label="Loading forms" />;
  if (forms.isError)
    return (
      <ErrorState message="We couldn't load the forms." onRetry={() => void forms.refetch()} />
    );
  return (
    <Stack spacing={3} sx={{ py: 4 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", gap: 2 }}
      >
        <Typography variant="h4" component="h1">
          Evaluation forms
        </Typography>
        <Button component={RouterLink} to="/admin/forms/new" variant="contained">
          New form
        </Button>
      </Stack>
      <Typography color="text.secondary">
        A form is the set of criteria and comment rules an evaluation period uses. Publishing
        freezes it, so past evaluations always show the questions they answered.
      </Typography>
      {forms.data.length === 0 ? (
        <Typography color="text.secondary">No forms yet.</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Forms">
            <TableHead>
              <TableRow>
                <TableCell>Version</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Criteria</TableCell>
                <TableCell>Published</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {forms.data.map((f) => (
                <TableRow key={f.public_id} hover>
                  <TableCell>v{f.version}</TableCell>
                  <TableCell>
                    <Link component={RouterLink} to={`/admin/forms/${f.public_id}`}>
                      {f.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={f.status === "PUBLISHED" ? "success" : "default"}
                      label={f.status === "PUBLISHED" ? "Published" : "Draft"}
                    />
                  </TableCell>
                  <TableCell align="right">{f.items.length}</TableCell>
                  <TableCell>{formatDateTime(f.published_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
