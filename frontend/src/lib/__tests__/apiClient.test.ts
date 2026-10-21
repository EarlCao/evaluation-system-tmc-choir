import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { api } from "@/test/handlers";
import { server } from "@/test/server";

import { apiClient, ensureCsrfCookie, readCookie } from "../apiClient";
import { ApiError } from "../errors";

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error("expected the request to fail");
}

describe("apiClient", () => {
  it("normalises the backend error envelope", async () => {
    server.use(
      http.post(api("/things/"), () =>
        HttpResponse.json(
          {
            error: {
              code: "validation_error",
              message: "Please correct the highlighted fields.",
              fields: { comment: ["This field is required."] },
            },
          },
          { status: 400 },
        ),
      ),
    );
    const error = await rejection(apiClient.post("/things/", {}));
    expect(error.status).toBe(400);
    expect(error.code).toBe("validation_error");
    expect(error.message).toBe("Please correct the highlighted fields.");
    expect(error.fields).toEqual({ comment: ["This field is required."] });
  });

  it("maps a 409 business rule violation without fields", async () => {
    server.use(
      http.post(api("/things/"), () =>
        HttpResponse.json(
          {
            error: {
              code: "business_rule_violation",
              message: "Registration is currently closed.",
            },
          },
          { status: 409 },
        ),
      ),
    );
    const error = await rejection(apiClient.post("/things/", {}));
    expect(error.code).toBe("business_rule_violation");
    expect(error.fields).toEqual({});
  });

  it("reports network failures", async () => {
    server.use(http.get(api("/things/"), () => HttpResponse.error()));
    const error = await rejection(apiClient.get("/things/"));
    expect(error.status).toBe(0);
    expect(error.code).toBe("network_error");
  });

  it("handles non-envelope error bodies", async () => {
    server.use(http.get(api("/things/"), () => new HttpResponse("Bad gateway", { status: 502 })));
    const error = await rejection(apiClient.get("/things/"));
    expect(error.status).toBe(502);
    expect(error.code).toBe("http_error");
  });

  it("sends the CSRF cookie as X-CSRFToken on unsafe requests", async () => {
    document.cookie = "csrftoken=abc123; path=/";
    let seen: string | null = null;
    server.use(
      http.post(api("/things/"), ({ request }) => {
        seen = request.headers.get("x-csrftoken");
        return HttpResponse.json({ ok: true });
      }),
    );
    await apiClient.post("/things/", {});
    expect(seen).toBe("abc123");
  });

  it("uses the same-origin /api/v1 base URL with credentials", () => {
    expect(apiClient.defaults.baseURL).toBe("/api/v1");
    expect(apiClient.defaults.withCredentials).toBe(true);
  });
});

describe("ensureCsrfCookie", () => {
  it("uses a returned token when the API cookie is on a separate origin", async () => {
    let header: string | null = null;
    server.use(
      http.get(api("/auth/csrf/"), () => HttpResponse.json({ csrf_token: "masked-token" })),
      http.post(api("/things/"), ({ request }) => {
        header = request.headers.get("x-csrftoken");
        return HttpResponse.json({ ok: true });
      }),
    );
    await ensureCsrfCookie();
    expect(readCookie("csrftoken")).toBeNull();
    await apiClient.post("/things/", {});
    expect(header).toBe("masked-token");
  });
  it("fetches the CSRF endpoint only when the cookie is missing", async () => {
    let calls = 0;
    server.use(
      http.get(api("/auth/csrf/"), () => {
        calls += 1;
        return HttpResponse.json({ detail: "CSRF cookie set." });
      }),
    );
    await ensureCsrfCookie();
    expect(calls).toBe(1);

    document.cookie = "csrftoken=present; path=/";
    expect(readCookie("csrftoken")).toBe("present");
    await ensureCsrfCookie();
    expect(calls).toBe(1);
  });
});
