import Alert from "@mui/material/Alert";

interface FormAlertProps {
  message?: string | undefined;
  severity?: "error" | "success" | "info" | "warning";
}

/** Form-level message (server errors, success notes). Announced to screen readers. */
export function FormAlert({ message, severity = "error" }: FormAlertProps) {
  if (!message) return null;
  return (
    <Alert severity={severity} role={severity === "error" ? "alert" : "status"}>
      {message}
    </Alert>
  );
}
