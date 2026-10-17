import type { CurrentUser } from "./types";

/** Only same-app paths are allowed as a return target (prevents open redirects). */
function isSafeInternalPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/login") &&
    !value.startsWith("/register")
  );
}

/** Where a user lands after logging in: back where they came from, else their home area. */
export function postLoginPath(user: CurrentUser, from: unknown): string {
  if (isSafeInternalPath(from)) {
    if (from.startsWith("/admin") && !user.is_super_admin) return "/app";
    return from;
  }
  return user.is_super_admin ? "/admin" : "/app";
}

export function fromState(state: unknown): unknown {
  return typeof state === "object" && state !== null && "from" in state ? state.from : undefined;
}
