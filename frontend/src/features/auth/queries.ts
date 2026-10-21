import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/errors";

import * as api from "./api";
import type { ChangePasswordInput, ConfirmResetInput, LoginInput } from "./schemas";

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

/** Member-only login mutation: refuses Super Admin accounts on the member login page. */
export function useMemberLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const user = await api.login(input);
      if (user.is_super_admin || user.role === "SUPER_ADMIN") {
        await api.logout().catch(() => undefined);
        queryClient.setQueryData(authKeys.currentUser(), null);
        throw new ApiError({
          status: 400,
          code: "invalid_credentials",
          message: "Super Admin accounts must sign in at /admin.",
        });
      }
      return user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.currentUser(), user);
    },
  });
}

/** Super Admin-only login mutation: refuses regular Member accounts on /admin. */
export function useAdminLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const user = await api.login(input);
      if (!user.is_super_admin && user.role !== "SUPER_ADMIN") {
        await api.logout().catch(() => undefined);
        queryClient.setQueryData(authKeys.currentUser(), null);
        throw new ApiError({
          status: 400,
          code: "invalid_credentials",
          message: "Only Super Admin accounts can sign in here.",
        });
      }
      return user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.currentUser(), user);
    },
  });
}

export const useLogin = useMemberLogin;

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

export function useConfirmPasswordResetWithOtp() {
  return useMutation({
    mutationFn: (input: { email: string; otp: string; new_password: string }) =>
      api.confirmPasswordResetWithOtp(input),
  });
}

export function useVerifyEmail(uid: string, token: string) {
  return useMutation({ mutationFn: () => api.verifyEmail(uid, token) });
}

export function useVerifyEmailOtp() {
  return useMutation({
    mutationFn: (input: { email: string; otp: string }) => api.verifyEmailOtp(input),
  });
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
