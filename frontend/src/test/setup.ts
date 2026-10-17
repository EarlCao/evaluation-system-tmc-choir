import "@testing-library/jest-dom/vitest";

import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./server";

// jsdom + MUI renders can be slow when test files run in parallel.
configure({ asyncUtilTimeout: 3000 });

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  // forget cookies between tests
  for (const cookie of document.cookie.split("; ")) {
    const name = cookie.split("=")[0];
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
});

afterAll(() => {
  server.close();
});
