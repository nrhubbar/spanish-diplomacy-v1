import type { ScenarioPlugin } from "../engine/modules";
import { builtInAssetSources } from "./assetSources";
import { createScenarioRegistry, type PackageSources, type ScenarioRegistry } from "./registry";

/**
 * The app's scenario registry, loaded on demand so the packages, the loader and Zod stay out of
 * the initial chunk (CP4, the chunk budget in `project/budgets.json`). Each package's files are
 * their own lazy chunks; the registry validates them all once they arrive.
 */
const lazy = {
  maps: import.meta.glob("/src/scenarios/*/map.json", { import: "default" }),
  plugins: import.meta.glob<ScenarioPlugin>("/src/scenarios/*/plugin.ts", { import: "plugin" }),
  scenarios: import.meta.glob("/src/scenarios/*/scenario.json", { import: "default" })
};

async function settle<Value>(loaders: Readonly<Record<string, () => Promise<Value>>>): Promise<Record<string, Value>> {
  const entries = await Promise.all(Object.entries(loaders).map(async ([path, load]) => [path, await load()] as const));
  return Object.fromEntries(entries);
}

export async function loadBuiltInRegistry(...extra: readonly PackageSources[]): Promise<ScenarioRegistry> {
  const [maps, plugins, scenarios] = await Promise.all([settle(lazy.maps), settle(lazy.plugins), settle(lazy.scenarios)]);
  return createScenarioRegistry({ ...builtInAssetSources, maps, plugins, scenarios }, ...extra);
}
