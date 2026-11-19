import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    exclude: ["e2e/**", "node_modules/**", "build/**"],
    setupFiles: ["src/test/setup.ts"],
    // Full user flows in jsdom, measured with coverage, share the CPU with the 200-game soak;
    // under that load the 5 s default timed out tests that pass in a quiet run.
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "html"],
      reportsDirectory: "build/coverage",
      include: ["src/main/**/*.{ts,tsx}", "src/sim/**/*.ts"],
      exclude: ["src/main/main.tsx", "src/main/**/*.json", "src/sim/cli.ts", "src/sim/test/**"],
      thresholds: {
        branches: 93,
        functions: 92,
        lines: 92,
        statements: 92
      }
    }
  }
});
