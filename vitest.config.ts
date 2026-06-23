import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90
      }
    }
  }
});
