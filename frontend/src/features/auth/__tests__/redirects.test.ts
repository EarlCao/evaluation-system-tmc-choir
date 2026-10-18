import { describe, expect, it } from "vitest";

import { memberUser, superAdminUser } from "@/test/handlers";

import { fromState, postLoginPath } from "../redirects";

describe("postLoginPath", () => {
  it.each([
    [undefined, "/app"],
    ["/app/profile", "/app/profile"],
    ["//evil.example/path", "/app"], // protocol-relative: open redirect attempt
    ["https://evil.example", "/app"],
    ["/login", "/app"],
    ["/admin", "/app"], // members never return into the admin area
  ])("member from %s → %s", (from, expected) => {
    expect(postLoginPath(memberUser, from)).toBe(expected);
  });

  it("super admins default to /admin, may return to /admin/*, and never go to /app/*", () => {
    expect(postLoginPath(superAdminUser, undefined)).toBe("/admin");
    expect(postLoginPath(superAdminUser, "/admin/settings")).toBe("/admin/settings");
    expect(postLoginPath(superAdminUser, "/app/profile")).toBe("/admin");
  });

  it("reads `from` from router state safely", () => {
    expect(fromState({ from: "/app" })).toBe("/app");
    expect(fromState(null)).toBeUndefined();
    expect(fromState("x")).toBeUndefined();
  });
});
