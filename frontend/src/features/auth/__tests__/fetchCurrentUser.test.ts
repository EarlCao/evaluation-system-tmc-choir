import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { api, loggedInAs, memberUser } from "@/test/handlers";
import { server } from "@/test/server";

import { fetchCurrentUser } from "../api";

describe("fetchCurrentUser", () => {
  it("returns null for anonymous visitors (401)", async () => {
    await expect(fetchCurrentUser()).resolves.toBeNull();
  });

  it("returns the user when logged in", async () => {
    server.use(loggedInAs(memberUser));
    await expect(fetchCurrentUser()).resolves.toEqual(memberUser);
  });

  it("propagates other errors", async () => {
    server.use(http.get(api("/auth/me/"), () => new HttpResponse(null, { status: 500 })));
    await expect(fetchCurrentUser()).rejects.toMatchObject({ status: 500 });
  });
});
