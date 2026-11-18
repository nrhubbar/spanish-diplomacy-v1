import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    exclude: ["e2e/**", "node_modules/**", "build/**"],
    setupFiles: ["src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "html"],
      reportsDirectory: "build/coverage",
      include: ["src/main/**/*.{ts,tsx}"],
      exclude: ["src/main/main.tsx", "src/main/**/*.json"],
      thresholds: {
        branches: 93,
        functions: 92,
        lines: 92,
        statements: 92
      }
    }
  }
});
