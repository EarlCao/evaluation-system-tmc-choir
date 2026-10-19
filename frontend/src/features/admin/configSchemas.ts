import { z } from "zod";

/** Mirrors backend `evaluations/scales.py` (the server stays authoritative). */
export const MAX_SCALE_POINTS = 101;
export const MAX_LABELLED_POINTS = 11;

const num = (message: string) => z.number({ error: message }).refine(Number.isFinite, message);

export const criterionSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name.").max(100, "Keep it under 100 characters."),
    description: z.string().trim().max(500, "Keep it under 500 characters."),
    category: z.string(),
    scale_type: z.enum(["NUMERIC", "PERCENT"]),
    min_value: num("Enter a number."),
    max_value: num("Enter a number."),
    step: num("Enter a number."),
    // One text per scale point, by position. (Not a record keyed by point value: React Hook Form
    // reads numeric path segments like "labels.1" as array indexes.)
    labels: z.array(z.string().max(60, "Keep labels under 60 characters.")),
    is_required: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.min_value < 0)
      ctx.addIssue({
        code: "custom",
        path: ["min_value"],
        message: "The minimum cannot be negative.",
      });
    if (v.max_value <= v.min_value) {
      ctx.addIssue({
        code: "custom",
        path: ["max_value"],
        message: "The maximum must be greater than the minimum.",
      });
      return;
    }
    if (v.scale_type === "PERCENT" && v.max_value > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["max_value"],
        message: "Percentage scales must stay within 0–100.",
      });
    }
    if (v.step <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["step"],
        message: "The step must be greater than zero.",
      });
      return;
    }
    const intervals = (v.max_value - v.min_value) / v.step;
    if (Math.abs(intervals - Math.round(intervals)) > 1e-9) {
      ctx.addIssue({
        code: "custom",
        path: ["step"],
        message: "The step must divide the range exactly.",
      });
    } else if (Math.round(intervals) + 1 > MAX_SCALE_POINTS) {
      ctx.addIssue({
        code: "custom",
        path: ["step"],
        message: `A scale can have at most ${String(MAX_SCALE_POINTS)} points.`,
      });
    }
  });
export type CriterionFormValues = z.infer<typeof criterionSchema>;

/** Scale points when the scale is valid and small enough to label each point; else []. */
export function labelledPoints(
  v: Pick<CriterionFormValues, "min_value" | "max_value" | "step">,
): number[] {
  const { min_value: min, max_value: max, step } = v;
  if (![min, max, step].every(Number.isFinite) || step <= 0 || max <= min) return [];
  const count = Math.round((max - min) / step) + 1;
  if (count > MAX_LABELLED_POINTS || Math.abs((max - min) / step - (count - 1)) > 1e-9) return [];
  return Array.from({ length: count }, (_, i) => Number((min + step * i).toFixed(2)));
}

export const formSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(120),
  criteria: z.array(z.string()).min(1, "Choose at least one criterion."),
  comment_required: z.boolean(),
  suggestion_required: z.boolean(),
  comment_max_length: num("Enter a number.").pipe(
    z.number().int().min(1).max(100000, "At most 100000."),
  ),
  suggestion_max_length: num("Enter a number.").pipe(
    z.number().int().min(1).max(100000, "At most 100000."),
  ),
  comment_prompts: z
    .array(
      z.object({
        key: z.string(),
        label: z.string().trim().min(1, "Enter a comment prompt label.").max(200),
        is_required: z.boolean(),
      }),
    )
    .min(1, "Add at least one comment prompt."),
});
export type FormValues = z.infer<typeof formSchema>;
