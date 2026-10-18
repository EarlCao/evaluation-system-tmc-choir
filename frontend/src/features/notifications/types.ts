export type NotificationType =
  | "FEEDBACK_AVAILABLE"
  | "CYCLE_OPENED"
  | "CYCLE_CLOSED"
  | "OWN_EVALUATION_EDITED"
  | "ACCOUNT_APPROVED"
  | "REGISTRATION_PENDING"
  | "UNUSUAL_ACTIVITY"
  | "CYCLE_COMPLETED";

/** GET /api/v1/notifications/ entry: the user's own, safe text only (RT-06). */
export interface AppNotification {
  public_id: string;
  type: NotificationType;
  message: string;
  link: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface UnreadCount {
  unread: number;
}
