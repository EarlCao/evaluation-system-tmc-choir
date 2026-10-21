import { describe, expect, it } from "vitest";

import { clearPrivateDrafts } from "../privateStorage";

describe("private drafts", () => {
  it("removes drafts from both stores without removing unrelated preferences", () => {
    localStorage.setItem("choir_eval_draft_cycle_recipient", "old private text");
    sessionStorage.setItem("choir_eval_draft_cycle_recipient", "private text");
    localStorage.setItem("theme", "dark");
    clearPrivateDrafts();
    expect(localStorage.getItem("choir_eval_draft_cycle_recipient")).toBeNull();
    expect(sessionStorage.getItem("choir_eval_draft_cycle_recipient")).toBeNull();
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
