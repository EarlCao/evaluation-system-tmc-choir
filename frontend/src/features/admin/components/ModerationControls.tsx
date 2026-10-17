import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { isApiError } from "@/lib/errors";

import { useModerate } from "../moderationQueries";
import {
  MODERATION_LABEL,
  TARGET_LABEL,
  type ModerationActionKind,
  type ModerationStatus,
  type ModerationTarget,
} from "../moderationTypes";

export function ModerationChip({ status }: { status: ModerationStatus }) {
  const color = { VISIBLE: "default", FLAGGED: "warning", HIDDEN: "error" } as const;
  return (
    <Chip size="small" variant="outlined" color={color[status]} label={MODERATION_LABEL[status]} />
  );
}

const AVAILABLE: Record<ModerationStatus, ModerationActionKind[]> = {
  VISIBLE: ["FLAG", "HIDE"],
  FLAGGED: ["HIDE", "RESTORE"],
  HIDDEN: ["RESTORE"],
};

function actionLabel(action: ModerationActionKind, status: ModerationStatus) {
  if (action === "FLAG") return "Flag";
  if (action === "HIDE") return "Hide";
  return status === "FLAGGED" ? "Clear flag" : "Restore";
}

const DESCRIPTION: Record<ModerationActionKind, string> = {
  FLAG: "Flagged content stays visible to the member. It is listed in the moderation queue until someone hides it or clears the flag.",
  HIDE: "The member will no longer see it. Nothing is deleted: you can restore it later, and the decision is kept in the moderation history.",
  RESTORE: "The member will see it again.",
};

/** ADM-05: flag / hide / restore one subject (the whole evaluation, or one of its texts). */
export function ModerationControls({
  evaluationId,
  target,
  status,
}: {
  evaluationId: string;
  target: ModerationTarget;
  status: ModerationStatus;
}) {
  const moderate = useModerate(evaluationId);
  const [action, setAction] = useState<ModerationActionKind | null>(null);
  const [reason, setReason] = useState("");
  const [missingReason, setMissingReason] = useState(false);
  const needsReason = action === "FLAG" || action === "HIDE";
  const subject = TARGET_LABEL[target];

  function close() {
    setAction(null);
    setReason("");
    setMissingReason(false);
    moderate.reset();
  }

  async function confirm() {
    if (!action) return;
    if (needsReason && !reason.trim()) {
      setMissingReason(true);
      return;
    }
    try {
      await moderate.mutateAsync({ action, target, reason: reason.trim() });
      close();
    } catch {
      // The error is shown in the dialog.
    }
  }

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <ModerationChip status={status} />
        {AVAILABLE[status].map((a) => (
          <Button
            key={a}
            size="small"
            color={a === "HIDE" ? "error" : "inherit"}
            variant="outlined"
            aria-label={`${actionLabel(a, status)} ${subject}`}
            onClick={() => {
              setAction(a);
            }}
          >
            {actionLabel(a, status)}
          </Button>
        ))}
      </Stack>
      <ConfirmDialog
        open={action !== null}
        pending={moderate.isPending}
        title={action ? `${actionLabel(action, status)} the ${subject}?` : ""}
        description={action ? DESCRIPTION[action] : ""}
        confirmLabel={action ? actionLabel(action, status) : ""}
        destructive={action === "HIDE"}
        onClose={close}
        onConfirm={() => void confirm()}
      >
        {needsReason ? (
          <TextField
            label="Reason (kept in the moderation history)"
            value={reason}
            required
            error={missingReason}
            helperText={missingReason ? "Say why." : undefined}
            onChange={(e) => {
              setReason(e.target.value);
              setMissingReason(false);
            }}
            fullWidth
            sx={{ mt: 2 }}
            slotProps={{ htmlInput: { maxLength: 300 } }}
          />
        ) : null}
        {moderate.error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {isApiError(moderate.error) ? moderate.error.message : "Something went wrong."}
          </Alert>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
