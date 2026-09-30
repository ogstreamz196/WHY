import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    // Unit tests only. Playwright specs under tests/e2e are run by `playwright test`
    // and crash if Vitest tries to execute them.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**", "dist/**", "tests/e2e/**"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
