import Button from "@mui/material/Button";
import { Link as RouterLink, useParams } from "react-router";

import { AuthCard } from "@/components/AuthCard";
import { FormAlert } from "@/components/form/FormAlert";

import { useVerifyEmail } from "../queries";

/**
 * Opened from /verify-email/:uid/:token. Confirmation needs an explicit click: links are
 * single-use, and email scanners or React StrictMode re-renders must not consume them.
 */
export function VerifyEmailPage() {
  const { uid = "", token = "" } = useParams();
  const verify = useVerifyEmail(uid, token);

  return (
    <AuthCard title="Confirm your email address">
      {verify.isSuccess ? (
        <>
          <FormAlert severity="success" message={verify.data.detail} />
          <Button component={RouterLink} to="/login" variant="contained">
            Log in
          </Button>
        </>
      ) : (
        <>
          <FormAlert message={verify.isError ? verify.error.message : undefined} />
          <Button
            variant="contained"
            size="large"
            disabled={verify.isPending}
            onClick={() => {
              verify.mutate();
            }}
          >
            {verify.isPending ? "Confirming…" : "Confirm my email"}
          </Button>
        </>
      )}
    </AuthCard>
  );
}
