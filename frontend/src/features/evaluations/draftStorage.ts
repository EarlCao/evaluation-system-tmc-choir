import type { EvaluationDraft } from "./schema";

const STORAGE_PREFIX = "choir_eval_draft";

export function getDraftStorageKey(cycleId: string, recipientId: string): string {
  return `${STORAGE_PREFIX}_${cycleId}_${recipientId}`;
}

export function saveEvaluationDraft(
  cycleId: string,
  recipientId: string,
  draft: EvaluationDraft,
): void {
  if (!cycleId || !recipientId) return;
  try {
    const key = getDraftStorageKey(cycleId, recipientId);
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Gracefully handle storage quota or disabled localStorage
  }
}

export function loadEvaluationDraft(
  cycleId: string,
  recipientId: string,
): EvaluationDraft | null {
  if (!cycleId || !recipientId) return null;
  try {
    const key = getDraftStorageKey(cycleId, recipientId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EvaluationDraft>;
    if (parsed && typeof parsed === "object" && parsed.ratings) {
      return {
        ratings: parsed.ratings ?? {},
        comment: parsed.comment ?? "",
        suggestion: parsed.suggestion ?? "",
        comments: parsed.comments ?? {},
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearEvaluationDraft(cycleId: string, recipientId: string): void {
  if (!cycleId || !recipientId) return;
  try {
    const key = getDraftStorageKey(cycleId, recipientId);
    localStorage.removeItem(key);
  } catch {
    // Gracefully handle
  }
}
