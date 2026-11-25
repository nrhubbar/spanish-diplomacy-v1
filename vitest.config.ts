import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // .claude/** holds agent worktrees (their tests are other checkouts); infra/** is the CDK app.
    exclude: ["e2e/**", "node_modules/**", "build/**", ".claude/**", "infra/**"],
    setupFiles: ["src/test/setup.ts"],
    // Full user flows in jsdom, measured with coverage, share the CPU with every other test file
    // (and the harness smoke run). The slowest takes 11 s on the CI host, and a longer limit only
    // lengthens a test that would fail.
    testTimeout: 60_000,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "html"],
      reportsDirectory: "build/coverage",
      include: ["src/main/**/*.{ts,tsx}", "src/sim/**/*.ts"],
      exclude: ["src/main/main.tsx", "src/main/**/*.json", "src/sim/cli.ts"],
      thresholds: {
        branches: 93,
        functions: 92,
        lines: 92,
        statements: 92
      }
    }
  }
});
