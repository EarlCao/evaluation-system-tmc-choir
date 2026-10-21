import type { EvaluationDraft } from "./schema";

const STORAGE_PREFIX = "choir_eval_draft";

export function getDraftStorageKey(cycleId: string, recipientId: string, ownerId: string): string {
  return `${STORAGE_PREFIX}_${ownerId}_${cycleId}_${recipientId}`;
}

export function saveEvaluationDraft(
  cycleId: string,
  recipientId: string,
  draft: EvaluationDraft,
  ownerId: string,
): void {
  if (!cycleId || !recipientId || !ownerId) return;
  try {
    const key = getDraftStorageKey(cycleId, recipientId, ownerId);
    sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Gracefully handle storage quota or disabled localStorage
  }
}

export function loadEvaluationDraft(
  cycleId: string,
  recipientId: string,
  ownerId: string,
): EvaluationDraft | null {
  if (!cycleId || !recipientId || !ownerId) return null;
  try {
    const key = getDraftStorageKey(cycleId, recipientId, ownerId);
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EvaluationDraft>;
    if (typeof parsed === "object" && parsed.ratings) {
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

export function clearEvaluationDraft(cycleId: string, recipientId: string, ownerId: string): void {
  if (!cycleId || !recipientId || !ownerId) return;
  try {
    const key = getDraftStorageKey(cycleId, recipientId, ownerId);
    sessionStorage.removeItem(key);
  } catch {
    // Gracefully handle
  }
}
