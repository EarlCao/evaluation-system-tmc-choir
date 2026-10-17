import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorState } from "@/components/ErrorState";
import { FullPageSpinner } from "@/components/FullPageSpinner";
import { isApiError } from "@/lib/errors";

import { CriterionDialog } from "../components/CriterionDialog";
import {
  useArchiveCriterion,
  useCategories,
  useCreateCategory,
  useCriteria,
  useReorderCriteria,
  useUpdateCriterion,
} from "../configQueries";
import type { Criterion } from "../configTypes";

const fmt = (n: number) => String(Number(n.toFixed(2)));

function scaleSummary(c: Criterion): string {
  const v = c.current_version;
  const range = `${fmt(v.min_value)}–${fmt(v.max_value)}`;
  return v.scale_type === "PERCENT"
    ? `${range} %, step ${fmt(v.step)}`
    : `${range}, step ${fmt(v.step)}`;
}

function errorText(error: unknown) {
  return isApiError(error) ? error.message : "Something went wrong.";
}

function Categories() {
  const categories = useCategories();
  const create = useCreateCategory();
  const [name, setName] = useState("");
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        Categories
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mb: 2 }}>
        {(categories.data ?? []).map((c) => (
          <Chip key={c.id} label={c.name} />
        ))}
        {categories.data?.length === 0 ? (
          <Typography color="text.secondary">No categories yet.</Typography>
        ) : null}
      </Stack>
      <Stack
        component="form"
        direction="row"
        spacing={1}
        aria-label="Add a category"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(name.trim(), {
            onSuccess: () => {
              setName("");
            },
          });
        }}
      >
        <TextField
          size="small"
          label="New category"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
        <Button type="submit" disabled={!name.trim() || create.isPending}>
          Add
        </Button>
      </Stack>
      {create.isError ? (
        <Alert severity="error" sx={{ mt: 1 }}>
          {errorText(create.error)}
        </Alert>
      ) : null}
    </Paper>
  );
}

/** EVAL-02 / CFG-01..03: create, rename, reorder, enable/disable and archive criteria. */
export function AdminCriteriaPage() {
  const [showArchived, setShowArchived] = useState(false);
  const criteria = useCriteria(showArchived);
  const update = useUpdateCriterion();
  const archive = useArchiveCriterion();
  const reorder = useReorderCriteria();
  const [editing, setEditing] = useState<Criterion | "new" | null>(null);
  const [archiving, setArchiving] = useState<Criterion | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (criteria.isPending) return <FullPageSpinner label="Loading criteria" />;
  if (criteria.isError) {
    return (
      <ErrorState
        message="We couldn't load the criteria."
        onRetry={() => void criteria.refetch()}
      />
    );
  }
  const active = criteria.data.filter((c) => !c.is_archived);
  const error = update.error ?? archive.error ?? reorder.error;

  function move(index: number, delta: -1 | 1) {
    const order = active.map((c) => c.public_id);
    const [item] = order.splice(index, 1);
    if (item === undefined) return;
    order.splice(index + delta, 0, item);
    reorder.mutate(order);
  }

  return (
    <Stack spacing={3} sx={{ py: 4 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", gap: 2 }}
      >
        <Typography variant="h4" component="h1">
          Rating criteria
        </Typography>
        <Button
          variant="contained"
          onClick={() => {
            setEditing("new");
          }}
        >
          New criterion
        </Button>
      </Stack>
      <Typography color="text.secondary">
        The order here is the order members see. Changes apply to forms you publish from now on.
      </Typography>
      {notice ? (
        <Alert
          severity="success"
          onClose={() => {
            setNotice(null);
          }}
        >
          {notice}
        </Alert>
      ) : null}
      {error ? <Alert severity="error">{errorText(error)}</Alert> : null}
      <FormControlLabel
        control={
          <Switch
            checked={showArchived}
            onChange={(e) => {
              setShowArchived(e.target.checked);
            }}
          />
        }
        label="Show archived criteria"
      />
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Criteria">
          <TableHead>
            <TableRow>
              <TableCell>Order</TableCell>
              <TableCell>Criterion</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Scale</TableCell>
              <TableCell>Version</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {criteria.data.map((c) => {
              const index = active.indexOf(c);
              const v = c.current_version;
              return (
                <TableRow key={c.public_id} sx={{ opacity: c.is_archived ? 0.6 : 1 }}>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {c.is_archived ? (
                      "—"
                    ) : (
                      <>
                        <IconButton
                          size="small"
                          aria-label={`Move ${v.name} up`}
                          disabled={index === 0 || reorder.isPending}
                          onClick={() => {
                            move(index, -1);
                          }}
                        >
                          ↑
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label={`Move ${v.name} down`}
                          disabled={index === active.length - 1 || reorder.isPending}
                          onClick={() => {
                            move(index, 1);
                          }}
                        >
                          ↓
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600 }}>{v.name}</Typography>
                    {v.description ? (
                      <Typography variant="body2" color="text.secondary">
                        {v.description}
                      </Typography>
                    ) : null}
                    {v.is_required ? null : <Chip size="small" label="Optional" sx={{ mt: 0.5 }} />}
                    {c.is_archived ? (
                      <Chip size="small" label="Archived" sx={{ mt: 0.5, ml: 0.5 }} />
                    ) : null}
                  </TableCell>
                  <TableCell>{c.category?.name ?? "—"}</TableCell>
                  <TableCell>{scaleSummary(c)}</TableCell>
                  <TableCell>v{v.version}</TableCell>
                  <TableCell>
                    <Switch
                      checked={c.is_active}
                      disabled={c.is_archived}
                      onChange={(e) => {
                        update.mutate({
                          id: c.public_id,
                          changes: { is_active: e.target.checked },
                        });
                      }}
                      slotProps={{ input: { "aria-label": `${v.name} active` } }}
                    />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {c.is_archived ? null : (
                      <>
                        <Button
                          size="small"
                          onClick={() => {
                            setEditing(c);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => {
                            setArchiving(c);
                          }}
                        >
                          Archive
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Categories />

      {editing ? (
        <CriterionDialog
          open
          criterion={editing === "new" ? undefined : editing}
          onClose={(saved) => {
            if (saved) setNotice(editing === "new" ? "Criterion created." : "Criterion saved.");
            setEditing(null);
          }}
        />
      ) : null}
      <ConfirmDialog
        open={archiving !== null}
        title="Archive this criterion?"
        description="It won't appear in new forms. Published forms and past evaluations keep it."
        confirmLabel="Archive"
        destructive
        pending={archive.isPending}
        onClose={() => {
          setArchiving(null);
        }}
        onConfirm={() => {
          if (archiving) {
            archive.mutate(archiving.public_id, {
              onSuccess: () => {
                setNotice("Criterion archived.");
              },
              onSettled: () => {
                setArchiving(null);
              },
            });
          }
        }}
      />
    </Stack>
  );
}
