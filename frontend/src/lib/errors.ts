/** Normalised API error. Every failed request rejects with one of these (see apiClient). */
export interface ApiErrorInit {
  status: number;
  code: string;
  message: string;
  fields?: Record<string, string[]>;
}

/** Backend error envelope (docs/06-API/API Conventions). */
export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string[]> };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string[]>;

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
