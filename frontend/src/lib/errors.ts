/** Field errors may nest, e.g. `{ ratings: { "12": ["Rate “Attendance”."] } }`. */
export interface FieldErrors {
  [field: string]: string[] | FieldErrors;
}

/** Normalised API error. Every failed request rejects with one of these (see apiClient). */
export interface ApiErrorInit {
  status: number;
  code: string;
  message: string;
  fields?: FieldErrors;
}

/** Backend error envelope (docs/06-API/API Conventions). */
export interface ApiErrorBody {
  error: { code: string; message: string; fields?: FieldErrors };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: FieldErrors;

  constructor({ status, code, message, fields }: ApiErrorInit) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields ?? {};
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const { error } = value;
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

/** Flatten nested field errors to dotted paths: `{ ratings: { "12": [...] } }` → `"ratings.12"`. */
export function flattenFieldErrors(fields: FieldErrors, prefix = ""): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) flat[path] = value.join(" ");
    else Object.assign(flat, flattenFieldErrors(value, path));
  }
  return flat;
}
