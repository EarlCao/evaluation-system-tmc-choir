import { describe, expect, it } from "vitest";

import { ownNameMentions } from "../identity";

const me = { first_name: "José", last_name: "Reyes", display_name: "Jo", username: "jreyes" };

describe("ownNameMentions (privacy: signed comments)", () => {
  it.each([
    ["Great blend this season. – José", ["José"]],
    ["great job, jose reyes!", ["José", "Reyes"]],
    ["@jreyes was here", ["jreyes"]],
    ["Josefina sang well", []], // part of another word
    ["Jo, keep it up", []], // names shorter than 3 letters are ignored
    ["", []],
  ])("%s", (text, expected) => {
    expect(ownNameMentions(text, me)).toEqual(expected);
  });

  it("does nothing without a signed-in user", () => {
    expect(ownNameMentions("José", null)).toEqual([]);
  });
});
