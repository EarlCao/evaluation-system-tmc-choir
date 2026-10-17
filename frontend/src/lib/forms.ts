import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { isApiError } from "./errors";

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

/**
 * Put server-side validation errors (API error envelope) onto the form: `fields` go to
 * matching inputs, everything else becomes the form-level `root.server` error.
 * The backend stays authoritative; client schemas only mirror it.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly Path<T>[],
): void {
  if (!isApiError(error)) {
    setError("root.server", { message: FALLBACK_MESSAGE });
    return;
  }
  const unmatched: string[] = [];
  for (const [field, messages] of Object.entries(error.fields)) {
    const message = messages.join(" ");
    if ((knownFields as readonly string[]).includes(field)) {
      setError(field as Path<T>, { type: "server", message });
    } else {
      unmatched.push(message);
    }
  }
  if (unmatched.length > 0 || Object.keys(error.fields).length === 0) {
    setError("root.server", { message: unmatched.join(" ") || error.message });
  }
}
