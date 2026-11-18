import type { PackageSources } from "../../../main/scenarios/registry";

/** Test-only scenario packages. Registered in unit tests and in the `e2e` Vite mode only. */
export const fixtureSources: PackageSources = {
  maps: import.meta.glob("/src/test/fixtures/scenarios/*/map.json", { eager: true, import: "default" }),
  rawAssets: import.meta.glob<string>("/src/test/fixtures/scenarios/*/*.svg", { import: "default", query: "?raw" }),
  scenarios: import.meta.glob("/src/test/fixtures/scenarios/*/scenario.json", { eager: true, import: "default" }),
  urlAssets: {}
};
