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
  useArchiveCommentPrompt,
  useArchiveCriterion,
  useCategories,
  useCommentPrompts,
  useCreateCategory,
  useCreateCommentPrompt,
  useCriteria,
  useDeleteCategory,
  useReorderCommentPrompts,
  useReorderCriteria,
  useUpdateCommentPrompt,
  useUpdateCriterion,
} from "../configQueries";
import type { Category, Criterion } from "../configTypes";

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

function CommentPromptsSection({ parentShowArchived }: { parentShowArchived: boolean }) {
  const [showArchivedPrompts, setShowArchivedPrompts] = useState(false);
  const includeArchived = showArchivedPrompts || parentShowArchived;
  const prompts = useCommentPrompts(includeArchived);
  const create = useCreateCommentPrompt();
  const update = useUpdateCommentPrompt();
  const archive = useArchiveCommentPrompt();
  const reorder = useReorderCommentPrompts();
  const [newLabel, setNewLabel] = useState("");
  const [newRequired, setNewRequired] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  const list = prompts.data ?? [];
  const active = list.filter((p) => !p.is_archived);
  const visibleRows = includeArchived ? list : active;
  const mutationError = create.error ?? update.error ?? archive.error ?? reorder.error;

  function movePrompt(index: number, delta: -1 | 1) {
    const order = active.map((p) => p.public_id);
    const [item] = order.splice(index, 1);
    if (item === undefined) return;
    order.splice(index + delta, 0, item);
    reorder.mutate(order);
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 1 }}
      >
        <Typography variant="h6" component="h2">
          Comment &amp; Suggestion Prompts
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={includeArchived}
              onChange={(e) => {
                setShowArchivedPrompts(e.target.checked);
              }}
            />
          }
          label="Show archived prompts"
        />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configure the numbered comment prompts shown on the Comments step after members rate the
        criteria (for example, <strong>1. Comments (Unsay imong ikaingon sa akoa?)</strong> followed
        by <strong>2. Suggestions (Unsay imong ikasuggest sa akoa?)</strong>). Members can write as
        many words as they want.
      </Typography>
      {mutationError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorText(mutationError)}
        </Alert>
      ) : null}
      {visibleRows.length > 0 ? (
        <TableContainer sx={{ mb: 2 }}>
          <Table size="small" aria-label="Comment prompts">
            <TableHead>
              <TableRow>
                <TableCell>Order</TableCell>
                <TableCell>Numbered Prompt</TableCell>
                <TableCell>Required</TableCell>
                <TableCell>Active</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRows.map((p) => {
                const index = active.indexOf(p);
                return (
                  <TableRow key={p.public_id} sx={{ opacity: p.is_archived ? 0.6 : 1 }}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {p.is_archived ? (
                        "—"
                      ) : (
                        <>
                          <IconButton
                            size="small"
                            aria-label={`Move ${p.label} up`}
                            disabled={index === 0 || reorder.isPending}
                            onClick={() => {
                              movePrompt(index, -1);
                            }}
                          >
                            ↑
                          </IconButton>
                          <IconButton
                            size="small"
                            aria-label={`Move ${p.label} down`}
                            disabled={index === active.length - 1 || reorder.isPending}
                            onClick={() => {
                              movePrompt(index, 1);
                            }}
                          >
                            ↓
                          </IconButton>
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === p.public_id ? (
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                          <TextField
                            size="small"
                            fullWidth
                            label="Prompt label"
                            value={editingLabel}
                            onChange={(e) => {
                              setEditingLabel(e.target.value);
                            }}
                          />
                          <Button
                            size="small"
                            variant="contained"
                            disabled={!editingLabel.trim() || update.isPending}
                            onClick={() => {
                              update.mutate(
                                { id: p.public_id, changes: { label: editingLabel.trim() } },
                                {
                                  onSuccess: () => {
                                    setEditingId(null);
                                  },
                                },
                              );
                            }}
                          >
                            Save
                          </Button>
                          <Button
                            size="small"
                            onClick={() => {
                              setEditingId(null);
                            }}
                          >
                            Cancel
                          </Button>
                        </Stack>
                      ) : (
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                          <Typography sx={{ fontWeight: 600 }}>
                            {p.is_archived ? p.label : `${String(index + 1)}. ${p.label}`}
                          </Typography>
                          {p.is_archived ? <Chip size="small" label="Archived" /> : null}
                        </Stack>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={p.is_required}
                        disabled={p.is_archived}
                        onChange={(e) => {
                          update.mutate({
                            id: p.public_id,
                            changes: { is_required: e.target.checked },
                          });
                        }}
                        slotProps={{ input: { "aria-label": `${p.label} required` } }}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={p.is_active}
                        disabled={p.is_archived}
                        onChange={(e) => {
                          update.mutate({
                            id: p.public_id,
                            changes: { is_active: e.target.checked },
                          });
                        }}
                        slotProps={{ input: { "aria-label": `${p.label} active` } }}
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {p.is_archived ? (
                        <Button
                          size="small"
                          disabled={update.isPending}
                          onClick={() => {
                            update.mutate({
                              id: p.public_id,
                              changes: { is_archived: false, is_active: true },
                            });
                          }}
                        >
                          Unarchive
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="small"
                            onClick={() => {
                              setEditingId(p.public_id);
                              setEditingLabel(p.label);
                            }}
                          >
                            Rename
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            disabled={archive.isPending}
                            onClick={() => {
                              archive.mutate(p.public_id);
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
      ) : null}
      <Stack
        component="form"
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ alignItems: { sm: "center" } }}
        aria-label="Add a comment prompt"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(
            { label: newLabel.trim(), is_required: newRequired },
            {
              onSuccess: () => {
                setNewLabel("");
                setNewRequired(false);
              },
            },
          );
        }}
      >
        <TextField
          size="small"
          label="New comment prompt"
          placeholder="e.g. Comments (Unsay imong ikaingon sa akoa?)"
          value={newLabel}
          onChange={(e) => {
            setNewLabel(e.target.value);
          }}
          sx={{ flex: 1 }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={newRequired}
              onChange={(e) => {
                setNewRequired(e.target.checked);
              }}
            />
          }
          label="Required"
        />
        <Button type="submit" variant="outlined" disabled={!newLabel.trim() || create.isPending}>
          Add prompt
        </Button>
      </Stack>
    </Paper>
  );
}

function Categories() {
  const categories = useCategories();
  const create = useCreateCategory();
  const remove = useDeleteCategory();
  const [name, setName] = useState("");
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const mutationError = create.error ?? remove.error;
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        Categories
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, mb: 2 }}>
        {(categories.data ?? []).map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            disabled={remove.isPending}
            onDelete={() => {
              setDeletingCategory(c);
            }}
          />
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
      {mutationError ? (
        <Alert severity="error" sx={{ mt: 1 }}>
          {errorText(mutationError)}
        </Alert>
      ) : null}
      <ConfirmDialog
        open={deletingCategory !== null}
        title={
          deletingCategory
            ? `Delete category “${deletingCategory.name}”?`
            : "Delete this category?"
        }
        description="Any criteria currently assigned to this category will become uncategorized."
        confirmLabel="Delete category"
        destructive
        pending={remove.isPending}
        onClose={() => {
          setDeletingCategory(null);
        }}
        onConfirm={() => {
          if (deletingCategory) {
            remove.mutate(deletingCategory.id, {
              onSettled: () => {
                setDeletingCategory(null);
              },
            });
          }
        }}
      />
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
                    {c.is_archived ? (
                      <Button
                        size="small"
                        disabled={update.isPending}
                        onClick={() => {
                          update.mutate(
                            {
                              id: c.public_id,
                              changes: { is_archived: false, is_active: true },
                            },
                            {
                              onSuccess: () => {
                                setNotice("Criterion unarchived.");
                              },
                            },
                          );
                        }}
                      >
                        Unarchive
                      </Button>
                    ) : (
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
      <CommentPromptsSection parentShowArchived={showArchived} />
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
