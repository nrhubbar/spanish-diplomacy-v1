import type { ScenarioPlugin } from "../engine/modules";
import type { PackageSources } from "./registry";

/**
 * Every shipped scenario package. Adding a folder with `scenario.json` and `map.json` under
 * `src/scenarios/` adds a scenario (see `src/scenarios/MANIFEST.md`); no code changes are required.
 */
export const builtInSources: PackageSources = {
  maps: import.meta.glob("/src/scenarios/*/map.json", { eager: true, import: "default" }),
  plugins: import.meta.glob<ScenarioPlugin>("/src/scenarios/*/plugin.ts", { eager: true, import: "plugin" }),
  rawAssets: import.meta.glob<string>(["/assets/maps/**/*.svg", "/assets/icons/**/*.svg"], {
    import: "default",
    query: "?raw"
  }),
  scenarios: import.meta.glob("/src/scenarios/*/scenario.json", { eager: true, import: "default" }),
  urlAssets: import.meta.glob<string>("/assets/maps/**/*.{png,jpg,webp}", { import: "default", query: "?url" })
};
