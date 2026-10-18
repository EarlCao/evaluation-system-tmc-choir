import axios, { isAxiosError } from "axios";

import { ApiError, isErrorBody } from "./errors";

export const CSRF_COOKIE = "csrftoken";

/**
 * The only HTTP client in the app (ADR-006).
 * - Same-origin `/api/v1` (Vite proxy in dev, Nginx in prod), so session cookies just work.
 * - axios reads the `csrftoken` cookie on every request and sends `X-CSRFToken`. Django
 *   rotates the token on login, so the header always reflects the current cookie.
 * - Every failure rejects with a normalised `ApiError`.
 */
const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

export const apiClient = axios.create({
  baseURL: configuredBaseUrl ? configuredBaseUrl.replace(/\/+$/, "") : "/api/v1",
  withCredentials: true,
  xsrfCookieName: CSRF_COOKIE,
  xsrfHeaderName: "X-CSRFToken",
  timeout: 15_000,
  headers: { Accept: "application/json" },
});

export function toApiError(error: unknown): ApiError {
  if (isAxiosError(error)) {
    const response = error.response;
    if (!response) {
      return new ApiError({
        status: 0,
        code: "network_error",
        message: "Can't reach the server. Check your connection and try again.",
      });
    }
    if (isErrorBody(response.data)) {
      const { code, message, fields } = response.data.error;
      return new ApiError({ status: response.status, code, message, fields: fields ?? {} });
    }
    return new ApiError({
      status: response.status,
      code: "http_error",
      message: `Unexpected server response (${response.status}).`,
    });
  }
  return new ApiError({ status: 0, code: "unknown_error", message: "Something went wrong." });
}

apiClient.interceptors.response.use(undefined, (error: unknown) =>
  Promise.reject(toApiError(error)),
);

export function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const match = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

/** Make sure the CSRF cookie exists before the first unsafe request (login, register...). */
export async function ensureCsrfCookie(): Promise<void> {
  if (readCookie(CSRF_COOKIE) === null) {
    await apiClient.get("/auth/csrf/");
  }
}
