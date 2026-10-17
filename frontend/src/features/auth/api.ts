import { apiClient } from "@/lib/apiClient";
import { isApiError } from "@/lib/errors";

import type { CurrentUser } from "./types";

/** The logged-in user, or `null` when not logged in (401). Other errors propagate. */
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const { data } = await apiClient.get<CurrentUser>("/auth/me/");
    return data;
  } catch (error) {
    if (isApiError(error) && error.status === 401) return null;
    throw error;
  }
}
