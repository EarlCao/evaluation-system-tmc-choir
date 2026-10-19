import { z } from "zod";

import { effectiveCommentPrompts, type CycleForm } from "./types";

/** Draft values: ratings keyed by criterion_version id (string), null = not rated yet. */
export interface EvaluationDraft {
  ratings: Record<string, number | null>;
  comment: string;
  suggestion: string;
  comments: Record<string, string>;
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
  const prompts = effectiveCommentPrompts(form);
  const commentsShape: Record<string, z.ZodType<string, string>> = {};
  for (const p of prompts) {
    const maxLen =
      p.key === "comment"
        ? form.comment_max_length || 100000
        : p.key === "suggestion"
          ? form.suggestion_max_length || 100000
          : 100000;
    commentsShape[p.key] = z
      .string()
      .max(maxLen, `Keep it under ${String(maxLen)} characters.`)
      .refine(
        (v) => !p.is_required || v.trim().length > 0,
        `${p.label} is required.`,
      );
  }

  return z.object({
    ratings: z.object(ratingShape),
    comment: z.string(),
    suggestion: z.string(),
    comments: z.object(commentsShape).catchall(z.string()),
  });
}

export function emptyDraft(form: CycleForm): EvaluationDraft {
  const prompts = effectiveCommentPrompts(form);
  return {
    ratings: Object.fromEntries(form.criteria.map((c) => [String(c.criterion_version), null])),
    comment: "",
    suggestion: "",
    comments: Object.fromEntries(prompts.map((p) => [p.key, ""])),
  };
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
