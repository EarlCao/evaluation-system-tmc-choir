import { z } from "zod";

import type { CycleForm } from "./types";

/** Draft values: ratings keyed by criterion_version id (string), null = not rated yet. */
export interface EvaluationDraft {
  ratings: Record<string, number | null>;
  comment: string;
  suggestion: string;
}

/** Zod schema generated from the cycle's form definition (mirrors the backend checks). */
export function buildDraftSchema(form: CycleForm) {
  const ratingShape: Record<string, z.ZodType<number | null, number | null>> = {};
  for (const c of form.criteria) {
    const base = z.number().nullable();
    ratingShape[String(c.criterion_version)] = c.is_required
      ? base.refine((v) => v !== null, `Rate “${c.name}”.`)
      : base;
  }
  const text = (required: boolean, max: number, label: string) =>
    z
      .string()
      .max(max, `Keep it under ${String(max)} characters.`)
      .refine((v) => !required || v.trim().length > 0, `${label} is required.`);

  return z.object({
    ratings: z.object(ratingShape),
    comment: text(form.comment_required, form.comment_max_length, "A comment"),
    suggestion: text(form.suggestion_required, form.suggestion_max_length, "A suggestion"),
  });
}

export function emptyDraft(form: CycleForm): EvaluationDraft {
  return {
    ratings: Object.fromEntries(form.criteria.map((c) => [String(c.criterion_version), null])),
    comment: "",
    suggestion: "",
  };
}
