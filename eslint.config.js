import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * The layers of `src/main`, lowest first. A layer imports only itself and layers below it, so the
 * rules and the game service run anywhere and the screens stay replaceable.
 */
const layers = ["engine", "ai", "scenarios", "game", "presentation", "assets", "state", "components", "map", "screens"];
/** Layers a lower bound alone does not settle. */
const extraBans = {
  ai: ["scenarios", "game"],
  game: ["presentation"],
  presentation: ["scenarios", "game", "ai"],
  scenarios: ["ai"],
  state: ["ai", "assets"],
  components: ["ai"],
  map: ["ai"],
  screens: ["ai"]
};
const pure = ["engine", "ai", "scenarios", "game", "presentation"];
const platform = [
  { group: ["react", "react-*", "react/*"], message: "This layer must not depend on React." },
  { group: ["@reduxjs/*", "react-redux"], message: "This layer must not depend on Redux." },
  { group: ["three", "three/*"], message: "This layer must not depend on rendering." }
];
const layerFence = (layer) => {
  const above = [...layers.slice(layers.indexOf(layer) + 1), ...(extraBans[layer] ?? []), ...(layer === "state" || layers.indexOf(layer) < layers.indexOf("state") ? ["audio", "notifications"] : [])];
  return {
    files: [`src/main/${layer}/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          ...(above.length === 0 ? [] : [{ regex: `^(\\.\\./)+(${above.join("|")})/`, message: `"${layer}" must not import a layer above it.` }]),
          ...(["game", "presentation", "state"].includes(layer) ? [{ regex: "^(\\.\\./)+(hooks|app|main)$", message: "Only components read the app's hooks." }] : []),
          { regex: "^(\\.\\./)+test/", message: "The app must not import its tests." },
          ...(pure.includes(layer) ? platform : []),
          ...(layer === "engine" || layer === "ai" || layer === "game" ? [{ group: ["**/*.json"], message: "Scenario data reaches the engine only through the loader." }] : [])
        ]
      }]
    }
  };
};

/**
 * The engine and the computer player explain themselves in codes (`Refusal`), never in English:
 * no text of three words or more, and none that ends as a sentence does, outside an error.
 */
const sentence = "/[A-Za-z]\\S* +\\S+ +\\S| [A-Za-z'-]+\\.$/u";
const unseen = ":not(ThrowStatement *, NewExpression[callee.name='Error'] *, CallExpression[callee.property.name=/^(describe|meta)$/] *)";
const noSentences = {
  files: ["src/main/engine/**/*.ts", "src/main/ai/**/*.ts", "src/main/state/**/*.{ts,tsx}", "src/main/game/**/*.ts"],
  rules: {
    "no-restricted-syntax": ["error", ...[`Literal[value=${sentence}]`, `TemplateElement[value.raw=${sentence}]`].map((selector) => ({
      message: "The engine and the computer player say why in a code (types/refusals.ts); presentation/refusals.ts writes the sentence.",
      selector: `${selector}${unseen}`
    }))]
  }
};

/**
 * Components only render and take input: they read the rules through presentation's view models.
 * This is the typed twin of the fence's rule, so it adds to the layer fences instead of replacing them.
 */
const renderOnly = {
  files: ["src/main/{screens,components,map}/**/*.tsx"],
  rules: {
    "@typescript-eslint/no-restricted-imports": ["error", {
      patterns: [{
        allowTypeImports: true,
        message: "Components only render and take input: ask the rules in a presentation view model.",
        regex: "^(\\.\\./)+engine/(?!(types|lookup)$)"
      }]
    }]
  }
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
  ...layers.map(layerFence),
  renderOnly,
  noSentences,
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
