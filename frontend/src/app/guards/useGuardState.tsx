import type { ReactNode } from "react";

import { ErrorState } from "@/components/ErrorState";
import { FullPageSpinner } from "@/components/FullPageSpinner";
import { useCurrentUser, type CurrentUser } from "@/features/auth";

type GuardState = { ready: false; fallback: ReactNode } | { ready: true; user: CurrentUser | null };

/** Shared loading/error handling for route guards. Guards are UX only: the API enforces access. */
export function useGuardState(): GuardState {
  const { data, isPending, isError, refetch } = useCurrentUser();
  if (isPending)
    return { ready: false, fallback: <FullPageSpinner label="Checking your session" /> };
  if (isError) {
    return {
      ready: false,
      fallback: (
        <ErrorState
          message="We couldn't check your session. Please try again."
          onRetry={() => void refetch()}
        />
      ),
    };
  }
  return { ready: true, user: data };
}
