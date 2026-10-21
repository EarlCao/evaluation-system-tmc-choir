import { expect, it } from "vitest";

import { loadEvaluationDraft, saveEvaluationDraft } from "../draftStorage";

it("isolates a saved draft by author, even when the recipient and cycle match", () => {
  const draft = { ratings: {}, comment: "Private", suggestion: "", comments: {} };
  saveEvaluationDraft("cycle", "recipient", draft, "author-one");
  expect(loadEvaluationDraft("cycle", "recipient", "author-two")).toBeNull();
  expect(loadEvaluationDraft("cycle", "recipient", "author-one")).toEqual(draft);
  expect(localStorage.length).toBe(0);
});
