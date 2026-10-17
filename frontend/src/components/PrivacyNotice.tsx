import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";

import { usePublicSettings } from "@/lib/systemSettings";

/** Shown before every submission (privacy rule, FB-06). Falls back to the built-in text. */
export const DEFAULT_PRIVACY_NOTICE =
  "Your name will not be shown to the member you evaluate or to other members. The Super " +
  "Admin can see who submitted each evaluation. Edits are kept in a history that only you " +
  "and the Super Admin can see.";

export function PrivacyNotice() {
  const settings = usePublicSettings();
  const text = settings.data?.privacy_notice || DEFAULT_PRIVACY_NOTICE;
  return (
    <Alert severity="info" variant="outlined" role="note">
      <AlertTitle>Who can see your evaluation</AlertTitle>
      <span style={{ whiteSpace: "pre-wrap" }}>{text}</span>
    </Alert>
  );
}
