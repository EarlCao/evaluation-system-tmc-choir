export type ScaleType = "NUMERIC" | "PERCENT";
export type CycleStatus = "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED";

export interface Category {
  id: number;
  name: string;
  sort_order: number;
  is_archived: boolean;
}

export interface CriterionVersion {
  id: number;
  version: number;
  name: string;
  description: string;
  scale_type: ScaleType;
  min_value: number;
  max_value: number;
  step: number;
  labels: Record<string, string>;
  is_required: boolean;
  created_at: string;
}

export interface Criterion {
  public_id: string;
  key: string;
  category: Category | null;
  sort_order: number;
  is_active: boolean;
  is_archived: boolean;
  current_version: CriterionVersion;
  created_at: string;
}

export interface CriterionInput {
  name: string;
  description: string;
  category: number | null;
  scale_type: ScaleType;
  min_value: number;
  max_value: number;
  step: number;
  labels: Record<string, string>;
  is_required: boolean;
}

export interface CommentPrompt {
  public_id: string;
  key: string;
  label: string;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  is_archived: boolean;
  created_at: string;
}

export interface CommentPromptInput {
  label: string;
  key?: string;
  is_required?: boolean;
}

export interface FormCommentPrompt {
  key: string;
  label: string;
  is_required: boolean;
}

export interface FormItem {
  order: number;
  criterion_public_id: string;
  criterion_version: CriterionVersion;
}

export interface FormVersion {
  public_id: string;
  version: number;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  comment_required: boolean;
  suggestion_required: boolean;
  comment_max_length: number;
  suggestion_max_length: number;
  comment_prompts?: FormCommentPrompt[];
  published_at: string | null;
  created_at: string;
  items: FormItem[];
}

export interface FormInput {
  title: string;
  criteria: string[];
  comment_required: boolean;
  suggestion_required: boolean;
  comment_max_length: number;
  suggestion_max_length: number;
  comment_prompts?: FormCommentPrompt[];
}

export interface AdminCycle {
  public_id: string;
  name: string;
  description: string;
  starts_at: string;
  ends_at: string;
  edit_deadline: string;
  status: CycleStatus;
  form_version: { public_id: string; version: number; title: string } | null;
  allow_resubmission: boolean;
  evaluation_scope: "ALL" | "SAME_SECTION";
  feedback_visibility: "IMMEDIATE" | "AFTER_CLOSE";
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
}

export type CycleInput = Partial<{
  name: string;
  description: string;
  starts_at: string;
  ends_at: string;
  edit_deadline: string | null;
  form_version: string | null;
  allow_resubmission: boolean;
  evaluation_scope: AdminCycle["evaluation_scope"];
  feedback_visibility: AdminCycle["feedback_visibility"];
}>;

/** Fields the server lets you change per status (mirrors `EDITABLE_WHEN` in the backend). */
export const CYCLE_EDITABLE: Record<CycleStatus, ReadonlySet<keyof CycleInput>> = {
  DRAFT: new Set([
    "name",
    "description",
    "starts_at",
    "ends_at",
    "edit_deadline",
    "form_version",
    "allow_resubmission",
    "evaluation_scope",
    "feedback_visibility",
  ]),
  OPEN: new Set(["name", "description", "ends_at", "edit_deadline"]),
  CLOSED: new Set(["name", "description"]),
  ARCHIVED: new Set(["name", "description"]),
};

export const CYCLE_STATUS_LABEL: Record<CycleStatus, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
};
