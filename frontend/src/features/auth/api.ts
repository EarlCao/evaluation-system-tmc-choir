import { apiClient, ensureCsrfCookie } from "@/lib/apiClient";
import { isApiError } from "@/lib/errors";
import { clearPrivateDrafts } from "@/lib/privateStorage";

import type {
  ChangePasswordInput,
  ConfirmResetInput,
  LoginInput,
  ProfileInput,
  RegisterPayload,
} from "./schemas";
import type { CurrentUser, Detail, RegistrationResult, VoiceSection } from "./types";

/** The logged-in user, or `null` when not logged in (401). Other errors propagate. */
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const { data } = await apiClient.get<CurrentUser>("/auth/me/");
    return data;
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      clearPrivateDrafts();
      return null;
    }
    throw error;
  }
}

export async function login(input: LoginInput): Promise<CurrentUser> {
  clearPrivateDrafts();
  await ensureCsrfCookie();
  const { data } = await apiClient.post<CurrentUser>("/auth/login/", input);
  return data;
}

export async function logout(): Promise<void> {
  clearPrivateDrafts();
  await apiClient.post("/auth/logout/");
}

export async function fetchVoiceSections(): Promise<VoiceSection[]> {
  const { data } = await apiClient.get<VoiceSection[]>("/members/voice-sections/");
  return data;
}

export async function register(payload: RegisterPayload): Promise<RegistrationResult> {
  await ensureCsrfCookie();
  const { data } = await apiClient.post<RegistrationResult>("/members/register/", payload, {
    headers: { "X-Defer-Account-Creation": "1" },
  });
  return data;
}

export async function requestPasswordReset(email: string): Promise<Detail> {
  await ensureCsrfCookie();
  const { data } = await apiClient.post<Detail>("/auth/password-reset/", { email });
  return data;
}

export async function confirmPasswordReset(
  input: ConfirmResetInput & { uid: string; token: string },
): Promise<Detail> {
  await ensureCsrfCookie();
  const { data } = await apiClient.post<Detail>("/auth/password-reset/confirm/", {
    uid: input.uid,
    token: input.token,
    new_password: input.new_password,
  });
  return data;
}

export async function confirmPasswordResetWithOtp(input: {
  email: string;
  otp: string;
  new_password: string;
}): Promise<Detail> {
  await ensureCsrfCookie();
  const { data } = await apiClient.post<Detail>("/auth/password-reset/confirm/", {
    email: input.email,
    otp: input.otp,
    new_password: input.new_password,
  });
  return data;
}

export async function verifyEmail(uid: string, token: string): Promise<Detail> {
  await ensureCsrfCookie();
  const { data } = await apiClient.post<Detail>("/auth/verify-email/", { uid, token });
  return data;
}

export async function verifyEmailOtp(input: { email: string; otp: string }): Promise<Detail> {
  await ensureCsrfCookie();
  const { data } = await apiClient.post<Detail>("/auth/verify-email/", input);
  return data;
}

export async function updateProfile(input: ProfileInput): Promise<CurrentUser> {
  const { data } = await apiClient.patch<CurrentUser>("/auth/me/", input);
  return data;
}

export async function changePassword(input: ChangePasswordInput): Promise<Detail> {
  const { data } = await apiClient.post<Detail>("/auth/password-change/", {
    old_password: input.old_password,
    new_password: input.new_password,
  });
  return data;
}

export async function downloadOwnData(): Promise<Record<string, unknown>> {
  const { data } = await apiClient.get<Record<string, unknown>>("/me/export/");
  return data;
}

export async function deactivateOwnAccount(input: {
  password: string;
  reason?: string;
}): Promise<Detail> {
  const { data } = await apiClient.post<Detail>("/auth/deactivate/", input);
  return data;
}
