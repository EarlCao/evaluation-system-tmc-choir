import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Django dev server. The SPA and API share one origin through this proxy, so session
// cookies and CSRF work without CORS (ADR-003). Non-default ports avoid clashes with other
// local projects (8000/5173 are commonly taken); override with env vars.
const backendUrl = process.env.VITE_BACKEND_URL ?? "http://127.0.0.1:8010";
const port = Number(process.env.FRONTEND_PORT ?? 5280);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port,
    strictPort: true,
    proxy: {
      // changeOrigin stays false: Django sees Host=localhost:<port>, matching the browser's
      // Origin header, so its CSRF origin check passes.
      "/api": { target: backendUrl },
      "/ws": { target: backendUrl.replace(/^http/, "ws"), ws: true },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    testTimeout: 15_000, // form tests type into many fields
    css: false,
  },
});
