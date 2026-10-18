import { z } from "zod";

/** Client-side mirrors of backend validation (the backend stays authoritative). */

export const PASSWORD_MIN_LENGTH = 10;

const name = (label: string) =>
  z.string().trim().min(1, `${label} is required.`).max(150, `${label} is too long.`);

const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(128, "Password is too long.")
  .refine((value) => !/^\d+$/.test(value), "The password can't be entirely numeric.");

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your username or email."),
  password: z.string().min(1, "Enter your password."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    first_name: name("First name"),
    last_name: name("Last name"),
    username: z
      .string()
      .trim()
      .min(1, "Choose a username.")
      .max(150, "Username is too long.")
      .regex(
        /^[a-z0-9_]+$/,
        "Use only lowercase letters (a-z), numbers (0-9), and underscores (_).",
      ),
    email: z.string().trim().pipe(z.email("Enter a valid email address.")),
    voice_section: z.string().min(1, "Choose your voice section."),
    password: newPassword,
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "The passwords don't match.",
    path: ["confirm_password"],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

/** Body of POST /members/register/. */
export interface RegisterPayload {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  voice_section: number;
  password: string;
}

export const verifyOtpSchema = z.object({
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit OTP code from your email."),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().pipe(z.email("Enter a valid email address.")),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const confirmResetSchema = z
  .object({ new_password: newPassword, confirm_password: z.string() })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "The passwords don't match.",
    path: ["confirm_password"],
  });
export type ConfirmResetInput = z.infer<typeof confirmResetSchema>;

export const resetPasswordWithOtpSchema = z
  .object({
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter the 6-digit OTP code from your email."),
    new_password: newPassword,
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "The passwords don't match.",
    path: ["confirm_password"],
  });
export type ResetPasswordWithOtpInput = z.infer<typeof resetPasswordWithOtpSchema>;

export const profileSchema = z.object({
  first_name: name("First name"),
  last_name: name("Last name"),
  display_name: z.string().trim().max(150, "Display name is too long."),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const changePasswordSchema = z
  .object({
    old_password: z.string().min(1, "Enter your current password."),
    new_password: newPassword,
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "The passwords don't match.",
    path: ["confirm_password"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
