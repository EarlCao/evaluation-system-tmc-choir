import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useRef, useState, type ChangeEvent } from "react";

import { ErrorState } from "@/components/ErrorState";
import { FullPageSpinner } from "@/components/FullPageSpinner";
import { formatDateTime } from "@/lib/datetime";
import { isApiError } from "@/lib/errors";

import { backupDownloadUrl } from "../systemApi";
import {
  useAdminSettings,
  useBackups,
  useCreateBackup,
  useDeleteBackup,
  useRestoreBackup,
  useRunRetentionCleanup,
} from "../systemQueries";
import type { BackupItem } from "../systemTypes";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function AdminDataManagementPage() {
  const settingsQuery = useAdminSettings();
  const backupsQuery = useBackups();
  const createBackupMutation = useCreateBackup();
  const deleteBackupMutation = useDeleteBackup();
  const restoreBackupMutation = useRestoreBackup();
  const retentionCleanupMutation = useRunRetentionCleanup();

  const [notification, setNotification] = useState<{
    severity: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [backupNote, setBackupNote] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<BackupItem | null>(null);

  const [restoreTarget, setRestoreTarget] = useState<BackupItem | null>(null);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadConfirmed, setUploadConfirmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cleanupOpen, setCleanupOpen] = useState(false);

  if (settingsQuery.isPending || backupsQuery.isPending) {
    return <FullPageSpinner label="Loading data management..." />;
  }

  if (settingsQuery.isError || backupsQuery.isError) {
    return (
      <ErrorState
        message="Failed to load data management. Please try again."
        onRetry={() => {
          void settingsQuery.refetch();
          void backupsQuery.refetch();
        }}
      />
    );
  }

  const settings = settingsQuery.data;
  const backups = backupsQuery.data ?? [];

  const handleCreate = async () => {
    try {
      await createBackupMutation.mutateAsync({ note: backupNote });
      setNotification({ severity: "success", message: "Database backup created successfully." });
      setCreateOpen(false);
      setBackupNote("");
    } catch (err) {
      setNotification({
        severity: "error",
        message: isApiError(err) ? err.message : "Failed to create backup.",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteBackupMutation.mutateAsync(deleteTarget.filename);
      setNotification({
        severity: "success",
        message: `Backup ${deleteTarget.filename} deleted successfully.`,
      });
      setDeleteTarget(null);
    } catch (err) {
      setNotification({
        severity: "error",
        message: isApiError(err) ? err.message : "Failed to delete backup.",
      });
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    try {
      const res = await restoreBackupMutation.mutateAsync({ filename: restoreTarget.filename });
      setNotification({
        severity: "success",
        message: res.message || "Database restored successfully.",
      });
      setRestoreTarget(null);
      setRestoreConfirmed(false);
    } catch (err) {
      setNotification({
        severity: "error",
        message: isApiError(err) ? err.message : "Failed to restore backup.",
      });
    }
  };

  const handleUploadRestore = async () => {
    if (!selectedFile) return;
    try {
      const res = await restoreBackupMutation.mutateAsync({ file: selectedFile });
      setNotification({
        severity: "success",
        message: res.message || "Database restored successfully from uploaded file.",
      });
      setUploadOpen(false);
      setSelectedFile(null);
      setUploadConfirmed(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setNotification({
        severity: "error",
        message: isApiError(err) ? err.message : "Failed to restore from uploaded file.",
      });
    }
  };

  const handleCleanup = async () => {
    try {
      const res = await retentionCleanupMutation.mutateAsync();
      setNotification({
        severity: "success",
        message: `Retention cleanup complete: purged ${String(res.purged_evaluations)} evaluations, ${String(res.purged_revisions)} revisions, and ${String(res.purged_audit_logs)} audit logs.`,
      });
      setCleanupOpen(false);
    } catch (err) {
      setNotification({
        severity: "error",
        message: isApiError(err) ? err.message : "Failed to run retention cleanup.",
      });
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  return (
    <Stack spacing={4} sx={{ py: 3, maxWidth: 1100, mx: "auto" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
        }}
      >
        <div>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
            Data Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Create and restore system database snapshots, download backups, and manage data
            retention lifecycles.
          </Typography>
        </div>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            onClick={() => {
              setUploadOpen(true);
              setSelectedFile(null);
              setUploadConfirmed(false);
            }}
            startIcon={
              <SvgIcon fontSize="small">
                <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" />
              </SvgIcon>
            }
          >
            Upload & Restore
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setBackupNote("");
              setCreateOpen(true);
            }}
            startIcon={
              <SvgIcon fontSize="small">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
              </SvgIcon>
            }
          >
            Create Backup
          </Button>
        </Stack>
      </Box>

      {/* Global alert */}
      {notification ? (
        <Alert severity={notification.severity} onClose={() => setNotification(null)}>
          {notification.message}
        </Alert>
      ) : null}

      {/* Retention lifecycle card */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{
              justifyContent: "space-between",
              alignItems: { xs: "flex-start", sm: "center" },
            }}
          >
            <div>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
                Data Retention & Lifecycle
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Evaluations retention:{" "}
                <strong>
                  {settings.retention_evaluations_days
                    ? `${String(settings.retention_evaluations_days)} days`
                    : "Indefinite"}
                </strong>{" "}
                · Revisions retention:{" "}
                <strong>
                  {settings.retention_revisions_days
                    ? `${String(settings.retention_revisions_days)} days`
                    : "Indefinite"}
                </strong>{" "}
                · Audit logs retention:{" "}
                <strong>
                  {settings.retention_audit_days
                    ? `${String(settings.retention_audit_days)} days`
                    : "Indefinite"}
                </strong>
              </Typography>
            </div>
            <Button
              variant="outlined"
              color="warning"
              onClick={() => setCleanupOpen(true)}
              disabled={retentionCleanupMutation.isPending}
              startIcon={
                <SvgIcon fontSize="small">
                  <path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z" />
                </SvgIcon>
              }
            >
              Run retention cleanup now
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Database Backups card */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <Box
          sx={{
            p: 2.5,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
              Database Backups
            </Typography>
            <Chip label={`${String(backups.length)} available`} size="small" variant="outlined" />
          </Box>
          <Button
            size="small"
            onClick={() => void backupsQuery.refetch()}
            startIcon={
              <SvgIcon fontSize="small">
                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
              </SvgIcon>
            }
          >
            Refresh
          </Button>
        </Box>

        {backups.length === 0 ? (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <SvgIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1.5 }}>
              <path d="M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2zm0 2c4.42 0 8 1.43 8 2.5S16.42 9 12 9s-8-1.43-8-2.5S7.58 4 12 4zm8 13.5c0 1.07-3.58 2.5-8 2.5s-8-1.43-8-2.5V15c1.94 1.25 5.02 2 8 2s6.06-.75 8-2v2.5zm0-4.5c0 1.07-3.58 2.5-8 2.5s-8-1.43-8-2.5V10.5c1.94 1.25 5.02 2 8 2s6.06-.75 8-2V13z" />
            </SvgIcon>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              No backups generated yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 420, mx: "auto" }}>
              Take a snapshot of all choir accounts, evaluations, ratings, comments, and settings to preserve your data.
            </Typography>
            <Button
              variant="contained"
              onClick={() => {
                setBackupNote("");
                setCreateOpen(true);
              }}
            >
              Create first backup
            </Button>
          </Box>
        ) : (
          <TableContainer>
            <Table aria-label="backups table">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Filename / Note</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Created By</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Size</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Checksum (SHA-256)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {backups.map((item) => (
                  <TableRow key={item.filename} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: "monospace" }}>
                        {item.filename}
                      </Typography>
                      {item.note ? (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                          {item.note}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDateTime(item.created_at)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={item.created_by || "system"} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatBytes(item.size_bytes)}</Typography>
                    </TableCell>
                    <TableCell>
                      {item.sha256 ? (
                        <Tooltip title={item.sha256} arrow>
                          <Typography
                            variant="caption"
                            sx={{
                              fontFamily: "monospace",
                              bgcolor: "action.hover",
                              px: 0.75,
                              py: 0.25,
                              borderRadius: 1,
                              display: "inline-block",
                            }}
                          >
                            {item.sha256.substring(0, 10)}...
                          </Typography>
                        </Tooltip>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                        <Tooltip title="Download backup">
                          <IconButton
                            size="small"
                            component="a"
                            href={backupDownloadUrl(item.filename)}
                            download={item.filename}
                            color="primary"
                            aria-label={`Download ${item.filename}`}
                          >
                            <SvgIcon fontSize="small">
                              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z" />
                            </SvgIcon>
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Restore database from this backup">
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => {
                              setRestoreTarget(item);
                              setRestoreConfirmed(false);
                            }}
                            aria-label={`Restore ${item.filename}`}
                          >
                            <SvgIcon fontSize="small">
                              <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
                            </SvgIcon>
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete backup">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteTarget(item)}
                            aria-label={`Delete ${item.filename}`}
                          >
                            <SvgIcon fontSize="small">
                              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                            </SvgIcon>
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Create Backup Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => !createBackupMutation.isPending && setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Create New Database Backup</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This generates a portable, gzipped snapshot of all database tables (excluding sessions and cache).
          </DialogContentText>
          <TextField
            autoFocus
            label="Optional Note or Description"
            placeholder="e.g. Before semester transition or cycle close"
            fullWidth
            value={backupNote}
            onChange={(e) => setBackupNote(e.target.value)}
            disabled={createBackupMutation.isPending}
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={createBackupMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleCreate()}
            disabled={createBackupMutation.isPending}
          >
            {createBackupMutation.isPending ? "Generating..." : "Generate Backup"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restore Backup Dialog */}
      <Dialog
        open={Boolean(restoreTarget)}
        onClose={() => !restoreBackupMutation.isPending && setRestoreTarget(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: "warning.main" }}>
          Restore Database from Backup
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>Caution:</strong> Restoring will update database records with data from the backup
            snapshot (<strong>{restoreTarget?.filename}</strong>). Any changes made since this backup
            was generated may be overwritten.
          </Alert>
          <DialogContentText sx={{ mb: 2 }}>
            Backup created on: {restoreTarget ? formatDateTime(restoreTarget.created_at) : ""}
            <br />
            Size: {restoreTarget ? formatBytes(restoreTarget.size_bytes) : ""}
          </DialogContentText>
          <FormControlLabel
            control={
              <Checkbox
                checked={restoreConfirmed}
                onChange={(e) => setRestoreConfirmed(e.target.checked)}
                disabled={restoreBackupMutation.isPending}
              />
            }
            label="I understand that existing records will be updated and restored to this state."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button
            onClick={() => setRestoreTarget(null)}
            disabled={restoreBackupMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => void handleRestore()}
            disabled={!restoreConfirmed || restoreBackupMutation.isPending}
          >
            {restoreBackupMutation.isPending ? "Restoring..." : "Confirm & Restore"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload and Restore Dialog */}
      <Dialog
        open={uploadOpen}
        onClose={() => !restoreBackupMutation.isPending && setUploadOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Upload & Restore Backup</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>Caution:</strong> Uploading a database backup will restore records from the
            provided file. Ensure you are uploading a valid backup produced by this system.
          </Alert>
          <Box sx={{ my: 2 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.gz,.json.gz"
              onChange={onFileChange}
              style={{ display: "block", marginBottom: 12 }}
            />
            {selectedFile ? (
              <Typography variant="body2" color="text.secondary">
                Selected: <strong>{selectedFile.name}</strong> ({formatBytes(selectedFile.size)})
              </Typography>
            ) : null}
          </Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={uploadConfirmed}
                onChange={(e) => setUploadConfirmed(e.target.checked)}
                disabled={restoreBackupMutation.isPending || !selectedFile}
              />
            }
            label="I confirm that I want to restore the database from this uploaded file."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setUploadOpen(false)} disabled={restoreBackupMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => void handleUploadRestore()}
            disabled={!uploadConfirmed || !selectedFile || restoreBackupMutation.isPending}
          >
            {restoreBackupMutation.isPending ? "Restoring..." : "Upload & Restore"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Backup Dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => !deleteBackupMutation.isPending && setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Backup?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete <strong>{deleteTarget?.filename}</strong>? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleteBackupMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void handleDelete()}
            disabled={deleteBackupMutation.isPending}
          >
            {deleteBackupMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Retention Cleanup Confirm Dialog */}
      <Dialog
        open={cleanupOpen}
        onClose={() => !retentionCleanupMutation.isPending && setCleanupOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Run Retention Cleanup?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently remove expired evaluations in closed cycles, old revisions, and
            expired audit logs according to current system retention policies.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setCleanupOpen(false)}
            disabled={retentionCleanupMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => void handleCleanup()}
            disabled={retentionCleanupMutation.isPending}
          >
            {retentionCleanupMutation.isPending ? "Cleaning up..." : "Execute Cleanup"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
