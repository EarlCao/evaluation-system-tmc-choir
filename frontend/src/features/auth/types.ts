export type UserRole = "MEMBER" | "SUPER_ADMIN";
export type UserStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";

/** GET /api/v1/auth/me/ (accounts MeSerializer). */
export interface CurrentUser {
  public_id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  role: UserRole;
  status: UserStatus;
  is_super_admin: boolean;
  email_verified: boolean;
  date_joined: string;
}
