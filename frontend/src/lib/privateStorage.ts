/** Remove private drafts on account changes, including legacy persistent drafts. */
export function clearPrivateDrafts(): void {
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[name];
      for (const key of Object.keys(storage)) {
        if (key.startsWith("choir_eval_draft_")) storage.removeItem(key);
      }
    } catch {
      // Storage may be disabled by the browser.
    }
  }
}
