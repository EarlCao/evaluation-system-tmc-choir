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

export interface FormCommentPrompt {
  key: string;
  label: string;
  is_required: boolean;
}

export interface CycleForm {
  cycle: CycleSummary;
  comment_required: boolean;
  suggestion_required: boolean;
  comment_max_length: number;
  suggestion_max_length: number;
  comment_prompts?: FormCommentPrompt[];
  criteria: FormCriterion[];
}

export const DEFAULT_COMMENT_PROMPTS: FormCommentPrompt[] = [
  {
    key: "comment",
    label: "Comments (Unsay imong ikaingon sa akoa?)",
    is_required: false,
  },
  {
    key: "suggestion",
    label: "Suggestions (Unsay imong ikasuggest sa akoa?)",
    is_required: false,
  },
  {
    key: "comment_3",
    label: "Strengths / Positive traits (Unsay maayo nga nakita nimo sa akoa?)",
    is_required: false,
  },
  {
    key: "comment_4",
    label: "Areas for growth (Unsay angay pa nakong palambuon?)",
    is_required: false,
  },
  {
    key: "comment_5",
    label: "Encouragement / Message (Unsay imong mensahe o pagdasig para sa akoa?)",
    is_required: false,
  },
];

export function effectiveCommentPrompts(
  form: Pick<CycleForm, "comment_prompts" | "comment_required" | "suggestion_required">,
  minCount = 5,
): FormCommentPrompt[] {
  const defaults: FormCommentPrompt[] = DEFAULT_COMMENT_PROMPTS.map((p) => ({
    ...p,
    is_required:
      p.key === "comment"
        ? form.comment_required
        : p.key === "suggestion"
          ? form.suggestion_required
          : p.is_required,
  }));
  let list: FormCommentPrompt[];
  if (form.comment_prompts && form.comment_prompts.length > 0) {
    if (
      form.comment_prompts.length === 2 &&
      form.comment_prompts[0]?.key === "comment" &&
      form.comment_prompts[1]?.key === "suggestion"
    ) {
      list = [...form.comment_prompts, ...defaults.slice(2)];
    } else {
      list = [...form.comment_prompts];
    }
  } else {
    list = [...defaults];
  }

  if (list.length < minCount) {
    const existingKeys = new Set(list.map((p) => p.key));
    for (const def of DEFAULT_COMMENT_PROMPTS) {
      if (list.length >= minCount) break;
      if (!existingKeys.has(def.key)) {
        list.push({ ...def });
        existingKeys.add(def.key);
      }
    }
    let extraIndex = list.length + 1;
    while (list.length < minCount) {
      const key = `comment_${extraIndex}`;
      if (!existingKeys.has(key)) {
        list.push({
          key,
          label: `Additional comment / suggestion #${extraIndex}`,
          is_required: false,
        });
        existingKeys.add(key);
      }
      extraIndex++;
    }
  } else if (list.length > minCount && (!form.comment_prompts || form.comment_prompts.length === 0)) {
    list = list.slice(0, minCount);
  }

  return list;
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
  comments?: Record<string, string>;
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

export interface MyCommentEntry {
  key: string;
  label: string;
  body: string;
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
  comments?: MyCommentEntry[];
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
  comments?: MyCommentEntry[] | Record<string, string>;
}

export interface Revision {
  revision_number: number;
  created_at: string;
  change_summary: string;
  snapshot: RevisionSnapshot;
}

export interface EditPayload {
  ratings: { criterion_version: number; value: number | null }[];
  comment: string;
  suggestion: string;
  comments?: Record<string, string>;
  change_summary: string;
}
