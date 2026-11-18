import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/** The engine and computer player stay pure: no UI, state, map, data files, or rendering (R1). */
const engineBoundary = {
  patterns: [
    { group: ["react", "react-*", "react/*"], message: "The engine must not depend on React." },
    { group: ["@reduxjs/*", "react-redux"], message: "The engine must not depend on Redux." },
    { group: ["three", "three/*"], message: "The engine must not depend on rendering." },
    { group: ["**/state/*", "**/map/*", "**/screens/*", "**/components/*", "**/scenarios/*"], message: "The engine must not import application layers or scenario data." },
    { group: ["**/*.json"], message: "Scenario data reaches the engine only through the loader." }
  ]
};

export default tseslint.config(
  { ignores: ["build/**", "dist/**", "node_modules/**", "coverage/**", "test-results/**"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { projectService: { allowDefaultProject: ["*.js", "scripts/*.mjs", "scripts/*.ts"] }, tsconfigRootDir: import.meta.dirname }
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }]
    }
  },
  {
    files: ["src/main/engine/**/*.ts", "src/main/ai/**/*.ts"],
    rules: { "no-restricted-imports": ["error", engineBoundary] }
  },
  {
    files: ["src/test/**/*.{ts,tsx}", "e2e/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      // E2E specs deliberately monkeypatch browser prototypes (for example to disable WebGL).
      "@typescript-eslint/unbound-method": "off"
    }
  },
  {
    files: ["**/*.js", "scripts/**/*.mjs", "scripts/**/*.ts"],
    ...tseslint.configs.disableTypeChecked
  }
);
