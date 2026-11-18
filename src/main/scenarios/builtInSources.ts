import type { PackageSources } from "./registry";

/**
 * Every shipped scenario package. Adding a folder with `scenario.json` and `map.json` under
 * `src/main/scenarios/` adds a scenario; no code changes are required.
 */
export const builtInSources: PackageSources = {
  maps: import.meta.glob("/src/main/scenarios/*/map.json", { eager: true, import: "default" }),
  rawAssets: import.meta.glob<string>(["/assets/maps/**/*.svg", "/assets/icons/**/*.svg"], {
    import: "default",
    query: "?raw"
  }),
  scenarios: import.meta.glob("/src/main/scenarios/*/scenario.json", { eager: true, import: "default" }),
  urlAssets: import.meta.glob<string>("/assets/maps/**/*.{png,jpg,webp}", { import: "default", query: "?url" })
};
