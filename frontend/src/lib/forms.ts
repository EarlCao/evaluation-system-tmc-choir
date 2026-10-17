import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { flattenFieldErrors, isApiError } from "./errors";

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
  const flat = flattenFieldErrors(error.fields);
  const known = knownFields as readonly string[];
  for (const [field, message] of Object.entries(flat)) {
    // Exact fields ("email") or nested fields under a known prefix ("ratings.12").
    if (known.includes(field) || known.some((k) => field.startsWith(`${k}.`))) {
      setError(field as Path<T>, { type: "server", message });
    } else {
      unmatched.push(message);
    }
  }
  if (unmatched.length > 0 || Object.keys(flat).length === 0) {
    setError("root.server", { message: unmatched.join(" ") || error.message });
  }
}
