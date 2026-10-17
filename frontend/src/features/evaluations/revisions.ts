import type { RevisionSnapshot } from "./types";

export interface Change {
  key: string;
  text: string;
}

/** What changed between two revisions, in words. */
export function describeChanges(previous: RevisionSnapshot, current: RevisionSnapshot): Change[] {
  const changes: Change[] = [];
  const before = new Map(previous.ratings.map((r) => [r.criterion_version_id, r]));
  for (const rating of current.ratings) {
    const old = before.get(rating.criterion_version_id);
    if ((old?.value ?? null) !== rating.value) {
      changes.push({
        key: `r${String(rating.criterion_version_id)}`,
        text: `${rating.criterion}: ${old?.value ?? "not rated"} → ${rating.value ?? "not rated"}`,
      });
    }
  }
  if (previous.comment !== current.comment)
    changes.push({ key: "comment", text: "Comment changed" });
  if (previous.suggestion !== current.suggestion) {
    changes.push({ key: "suggestion", text: "Suggestion changed" });
  }
  return changes;
}
