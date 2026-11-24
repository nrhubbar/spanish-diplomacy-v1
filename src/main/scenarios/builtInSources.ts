import type { ScenarioPlugin } from "../engine/modules";
import { builtInAssetSources } from "./assetSources";
import type { PackageSources } from "./registry";

/**
 * Every shipped scenario package, loaded eagerly: for tests and the headless harness, which
 * need a registry synchronously. The app loads the same packages lazily (`lazySources.ts`).
 * Adding a folder with `scenario.json` and `map.json` under `src/scenarios/` adds a scenario; no
 * code changes are required.
 */
export const builtInSources: PackageSources = {
  ...builtInAssetSources,
  maps: import.meta.glob("/src/scenarios/*/map.json", { eager: true, import: "default" }),
  plugins: import.meta.glob<ScenarioPlugin>("/src/scenarios/*/plugin.ts", { eager: true, import: "plugin" }),
  scenarios: import.meta.glob("/src/scenarios/*/scenario.json", { eager: true, import: "default" })
};
