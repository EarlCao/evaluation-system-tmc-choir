import type { RevisionSnapshot } from "@/features/evaluations";

import type { ScaleType } from "./configTypes";

export type ModerationStatus = "VISIBLE" | "FLAGGED" | "HIDDEN";
export type ModerationActionKind = "FLAG" | "HIDE" | "RESTORE";
export type ModerationTarget = "EVALUATION" | "COMMENT" | "SUGGESTION";

/** An evaluator or recipient as the Super Admin sees them. */
export interface Person {
  public_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  voice_section: string | null;
}

export interface AdminRating {
  criterion_public_id: string;
  criterion_name: string;
  criterion_version: number;
  scale_type: ScaleType;
  max_value: number;
  value: number | null;
  label: string;
}

export interface AdminText {
  body: string;
  moderation_status: ModerationStatus;
}

/** GET /api/v1/admin/evaluations/ entry (ADM-02). Reveals who wrote it, so it is audited. */
export interface AdminEvaluation {
  public_id: string;
  cycle: { public_id: string; name: string; status: string };
  evaluator: Person;
  recipient: Person;
  submitted_at: string;
  last_edited_at: string | null;
  is_edited: boolean;
  current_revision_number: number;
  moderation_status: ModerationStatus;
  needs_attention: boolean;
  ratings: AdminRating[];
  comment: AdminText | null;
  suggestion: AdminText | null;
}

export interface ModerationEntry {
  target: ModerationTarget;
  action: ModerationActionKind;
  reason: string;
  actor: string;
  created_at: string;
}

export interface AdminEvaluationDetail extends AdminEvaluation {
  moderation_history: ModerationEntry[];
}

export interface AdminRevision {
  revision_number: number;
  created_at: string;
  change_summary: string;
  editor: Person;
  snapshot: RevisionSnapshot;
}

export interface AdminEvaluationFilters {
  recipient?: string;
  evaluator?: string;
  cycle?: string;
  criterion?: string;
  rating_min?: string;
  rating_max?: string;
  submitted_from?: string;
  submitted_to?: string;
  moderation?: ModerationStatus | "attention" | "";
  edited?: "true" | "false" | "";
  page?: number;
}

export const MODERATION_LABEL: Record<ModerationStatus, string> = {
  VISIBLE: "Visible",
  FLAGGED: "Flagged",
  HIDDEN: "Hidden",
};

export const TARGET_LABEL: Record<ModerationTarget, string> = {
  EVALUATION: "whole evaluation",
  COMMENT: "comment",
  SUGGESTION: "suggestion",
};

export const ACTION_LABEL: Record<ModerationActionKind, string> = {
  FLAG: "Flagged",
  HIDE: "Hidden",
  RESTORE: "Restored",
};

export const personName = (p: Person) => `${p.first_name} ${p.last_name}`.trim() || p.display_name;

export function formatRating(r: Pick<AdminRating, "value" | "max_value" | "scale_type">) {
  if (r.value === null) return "not rated";
  return r.scale_type === "PERCENT"
    ? `${String(r.value)}%`
    : `${String(r.value)}/${String(r.max_value)}`;
}
