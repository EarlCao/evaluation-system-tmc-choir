import type { VoiceSection } from "@/features/auth";

export type ScaleType = "NUMERIC" | "PERCENT";
export type CycleStatus = "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED";

export interface CycleSummary {
  public_id: string;
  name: string;
  description: string;
  status: CycleStatus;
  starts_at: string;
  ends_at: string;
  edit_deadline: string;
  evaluation_scope: "ALL" | "SAME_SECTION";
  allow_resubmission: boolean;
}

/** One criterion of the cycle's published form (criterion version + scale). */
export interface FormCriterion {
  order: number;
  criterion_version: number;
  name: string;
  description: string;
  category: string | null;
  scale_type: ScaleType;
  min_value: number;
  max_value: number;
  step: number;
  labels: Record<string, string>;
  is_required: boolean;
}

export interface CycleForm {
  cycle: CycleSummary;
  comment_required: boolean;
  suggestion_required: boolean;
  comment_max_length: number;
  suggestion_max_length: number;
  criteria: FormCriterion[];
}

export type IneligibilityReason =
  | "SELF"
  | "NOT_A_MEMBER"
  | "NO_OPEN_CYCLE"
  | "NOT_STARTED"
  | "ENDED"
  | "NOT_EVALUABLE"
  | "OUT_OF_SCOPE"
  | "ALREADY_EVALUATED";

export interface Eligibility {
  can_evaluate: boolean;
  reason: IneligibilityReason | null;
  message: string | null;
  existing_evaluation: string | null;
}

export interface SubmitPayload {
  recipient: string;
  ratings: { criterion_version: number; value: number | null }[];
  comment: string;
  suggestion: string;
}

export interface Recipient {
  public_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  voice_section: VoiceSection | null;
}

export interface MyRating {
  criterion_version: {
    id: number;
    name: string;
    scale_type: ScaleType;
    min_value: number;
    max_value: number;
    step: number;
    labels: Record<string, string>;
  };
  value: number | null;
  label: string;
}

/** An evaluation as its author sees it (MINE-01). */
export interface MyEvaluation {
  public_id: string;
  cycle: CycleSummary;
  recipient: Recipient;
  submitted_at: string;
  last_edited_at: string | null;
  is_edited: boolean;
  current_revision_number: number;
  ratings: MyRating[];
  comment: string;
  suggestion: string;
  can_edit: boolean;
}

export function recipientName(r: Pick<Recipient, "first_name" | "last_name" | "display_name">) {
  const full = `${r.first_name} ${r.last_name}`.trim();
  return r.display_name ? `${r.display_name} (${full})` : full;
}

/** Same canonical key as the backend (`scales.point_key`): 4 → "4", 2.5 → "2.5". */
export function pointKey(value: number): string {
  return String(Number(value.toFixed(2)));
}

export function scalePoints(c: Pick<FormCriterion, "min_value" | "max_value" | "step">): number[] {
  const points: number[] = [];
  const count = Math.round((c.max_value - c.min_value) / c.step) + 1;
  for (let i = 0; i < count; i += 1) points.push(Number((c.min_value + c.step * i).toFixed(2)));
  return points;
}

/** One immutable revision (MINE-04), visible to the author only. */
export interface RevisionSnapshot {
  form_version_id: number;
  ratings: {
    criterion_version_id: number;
    criterion: string;
    value: string | null;
    label: string;
  }[];
  comment: string;
  suggestion: string;
}

export interface Revision {
  revision_number: number;
  created_at: string;
  editor: { public_id: string; first_name: string; last_name: string };
  change_summary: string;
  snapshot: RevisionSnapshot;
}

export interface EditPayload {
  ratings: { criterion_version: number; value: number | null }[];
  comment: string;
  suggestion: string;
  change_summary: string;
}
