import { useQuery } from "@tanstack/react-query";

import { fetchCurrentUser } from "./api";

export const authKeys = {
  all: ["auth"] as const,
  currentUser: () => [...authKeys.all, "current-user"] as const,
};

/** Session state for guards and layouts. `data` is `null` for anonymous visitors. */
export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.currentUser(),
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60_000,
  });
}
