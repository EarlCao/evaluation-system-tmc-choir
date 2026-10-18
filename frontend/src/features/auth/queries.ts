import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "./api";
import type { ChangePasswordInput, ConfirmResetInput } from "./schemas";

export const authKeys = {
  all: ["auth"] as const,
  currentUser: () => [...authKeys.all, "current-user"] as const,
  voiceSections: () => [...authKeys.all, "voice-sections"] as const,
};

/** Session state for guards and layouts. `data` is `null` for anonymous visitors. */
export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.currentUser(),
    queryFn: api.fetchCurrentUser,
    staleTime: 5 * 60_000,
  });
}

export function useVoiceSections() {
  return useQuery({
    queryKey: authKeys.voiceSections(),
    queryFn: api.fetchVoiceSections,
    staleTime: 60 * 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.login,
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.currentUser(), user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    onSettled: () => {
      // Drop every cached server response that belonged to the previous user.
      queryClient.clear();
      queryClient.setQueryData(authKeys.currentUser(), null);
    },
  });
}

export function useRegister() {
  return useMutation({ mutationFn: api.register });
}

export function useRequestPasswordReset() {
  return useMutation({ mutationFn: api.requestPasswordReset });
}

export function useConfirmPasswordReset(uid: string, token: string) {
  return useMutation({
    mutationFn: (input: ConfirmResetInput) => api.confirmPasswordReset({ ...input, uid, token }),
  });
}

export function useVerifyEmail(uid: string, token: string) {
  return useMutation({ mutationFn: () => api.verifyEmail(uid, token) });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.updateProfile,
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.currentUser(), user);
    },
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: (input: ChangePasswordInput) => api.changePassword(input) });
}

export function useDownloadOwnData() {
  return useMutation({ mutationFn: api.downloadOwnData });
}

export function useDeactivateOwnAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deactivateOwnAccount,
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(authKeys.currentUser(), null);
    },
  });
}

