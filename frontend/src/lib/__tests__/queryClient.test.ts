import { describe, expect, it } from "vitest";

import { ApiError } from "../errors";
import { shouldRetry } from "../queryClient";

const err = (status: number) => new ApiError({ status, code: "x", message: "x" });

describe("shouldRetry", () => {
  it.each([400, 401, 403, 404, 409, 429])("never retries %i", (status) => {
    expect(shouldRetry(0, err(status))).toBe(false);
  });

  it("retries server and network errors up to twice", () => {
    expect(shouldRetry(0, err(503))).toBe(true);
    expect(shouldRetry(1, err(0))).toBe(true);
    expect(shouldRetry(2, err(500))).toBe(false);
  });
});
