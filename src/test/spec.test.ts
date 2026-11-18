import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { checkGeometry, loadPackage, PackageValidationError } from "../main/scenarios/loader";
import { builtInSources } from "../main/scenarios/builtInSources";
import { createScenarioRegistry } from "../main/scenarios/registry";
import { mapSchema } from "../main/scenarios/schema/mapSchema";
import { scenarioSchema } from "../main/scenarios/schema/scenarioSchema";
import tinyMap from "./fixtures/scenarios/tiny-front/map.json";
import tinyScenario from "./fixtures/scenarios/tiny-front/scenario.json";
import { testRegistry, tinyId } from "./support";

type Json = Record<string, unknown>;
const clone = <Value>(value: Value): Value => structuredClone(value);
const assetPaths = new Set([
  "src/test/fixtures/scenarios/tiny-front/geometry.svg",
  "src/test/fixtures/scenarios/tiny-front/foot.svg"
]);

function issuesFor(mutate: (scenario: Json, map: Json) => void): readonly string[] {
  const scenario = clone(tinyScenario) as unknown as Json;
  const map = clone(tinyMap) as unknown as Json;
  mutate(scenario, map);
  try {
    loadPackage({ assetPaths, mapDocument: map, mapPath: "map.json", scenarioDocument: scenario, scenarioPath: "scenario.json" });
    return [];
  } catch (error) {
    if (error instanceof PackageValidationError) return error.issues;
    throw error;
  }
}

const list = (value: unknown): Json[] => value as Json[];

describe("published specification", () => {
  it("keeps the committed JSON Schemas in sync with the Zod sources (spec:check)", () => {
    for (const [file, schema] of [["scenario.schema.json", scenarioSchema], ["map.schema.json", mapSchema]] as const) {
      const committed: unknown = JSON.parse(readFileSync(`src/main/scenarios/schema/${file}`, "utf8"));
      expect(committed, `${file} is stale; run npm run spec:build`).toEqual(JSON.parse(JSON.stringify(z.toJSONSchema(schema, { io: "input" }))));
    }
  });

  it("loads every registered package without problems", () => {
    expect(testRegistry().problems.map((problem) => problem.message)).toEqual([]);
    expect(testRegistry().list().map((summary) => summary.id)).toEqual(["spain-1936-07-31", "tiny-front"]);
    expect(createScenarioRegistry(builtInSources).problems).toEqual([]);
  });

  it("finds every map asset for every package (L11)", async () => {
    for (const summary of testRegistry().list()) {
      const assets = await testRegistry().loadAssets(summary.id);
      expect(assets.geometrySvg.length).toBeGreaterThan(100);
      expect(assets.unitSymbols.size).toBeGreaterThan(0);
    }
  });
});

describe("map asset provenance", () => {
  it("ships exactly the reviewed map assets (assets/maps/checksums.json)", () => {
    const expected = JSON.parse(readFileSync("assets/maps/checksums.json", "utf8")) as Record<string, string>;
    const files = readdirSync("assets/maps").filter((name) => /\.(svg|png|jpg|webp)$/.test(name)).sort();
    const actual = Object.fromEntries(files.map((name) => [name, createHash("sha256").update(readFileSync(`assets/maps/${name}`)).digest("hex")]));
    expect(actual, "map assets changed; review them, then run npm run maps:checksums").toEqual(expected);
  });
});

describe("loader rules", () => {
  it("accepts the fixture as written", () => {
    expect(issuesFor(() => undefined)).toEqual([]);
  });

  it.each([
    ["L1 schema", (scenario: Json) => { scenario["ruleset"] = "m4-combined-arms"; }, "ruleset"],
    ["L1 map schema", (_scenario: Json, map: Json) => { map["specVersion"] = 2; }, "specVersion"],
    ["L2 duplicate ids", (scenario: Json) => { list(scenario["units"]).push(clone(list(scenario["units"])[0]!)); }, "(L2)"],
    ["L3 unknown reference", (scenario: Json) => { list(scenario["units"])[0]!["cityId"] = "las-palmas"; }, "unknown city"],
    ["L3 unknown objective", (scenario: Json) => { list(scenario["factions"])[0]!["objectiveTerritoryIds"] = ["atlantis"]; }, "unknown territory"],
    ["L4 city outside territory", (scenario: Json) => { list(scenario["units"])[0]!["cityId"] = "port-town"; }, "(L4)"],
    ["L5 contested duplicates", (scenario: Json) => { list(scenario["territories"])[4]!["initialControl"] = { factionIds: ["red", "red"], kind: "contested" }; }, "(L5)"],
    ["L6 self loop", (scenario: Json) => { list(scenario["connections"]).push({ between: ["harbor", "harbor"], kind: "land" }); }, "(L6)"],
    ["L6 duplicate connection", (scenario: Json) => { list(scenario["connections"]).push({ between: ["highlands", "westfold"], kind: "land" }); }, "(L6)"],
    ["L7 unreachable", (scenario: Json) => { scenario["connections"] = list(scenario["connections"]).filter((connection) => !(connection["between"] as string[]).includes("isle")); }, "(L7)"],
    ["L7 isolated but connected", (scenario: Json) => { list(scenario["territories"])[4]!["isolated"] = { reason: "test" }; }, "(L7)"],
    ["L8 empty faction", (scenario: Json) => {
      scenario["units"] = list(scenario["units"]).filter((unit) => unit["factionId"] !== "blue");
      for (const territory of list(scenario["territories"])) {
        if ((territory["initialControl"] as Json)["factionId"] === "blue") territory["initialControl"] = { factionId: "red", kind: "controlled" };
      }
    }, "(L8)"],
    ["L9 starts at threshold", (scenario: Json) => { list(scenario["territories"])[3]!["initialControl"] = { factionId: "red", kind: "controlled" }; }, "(L9)"],
    ["L10 missing territory entry", (_scenario: Json, map: Json) => { delete (map["territories"] as Json)["isle"]; }, "missing \"isle\""],
    ["L10 anchor outside view box", (_scenario: Json, map: Json) => { ((map["territories"] as Json)["harbor"] as Json)["unitAnchor"] = { x: 999, y: 1 }; }, "outside the view box"],
    ["L10 missing city position", (_scenario: Json, map: Json) => { delete (map["cities"] as Json)["port-town"]; }, "missing \"port-town\""],
    ["L10 region bound to unknown territory", (_scenario: Json, map: Json) => { (map["regions"] as Json)["tf-ghost"] = { territoryId: "ghost" }; }, "unknown territory"],
    ["L10 territory without geometry", (_scenario: Json, map: Json) => { delete ((map["territories"] as Json)["isle"] as Json)["shape"]; }, "needs a bound SVG region"],
    ["L10 missing unit symbol", (_scenario: Json, map: Json) => { map["unitSymbols"] = {}; }, "unitSymbols"],
    ["L11 missing asset", (_scenario: Json, map: Json) => { (map["geometry"] as Json)["svg"] = "assets/maps/missing.svg"; }, "(L11)"]
  ])("rejects %s", (_name, mutate, expected) => {
    expect(issuesFor(mutate).join("\n")).toContain(expected);
  });

  it("checks that bound regions exist in the geometry", () => {
    const { map } = testRegistry().require(tinyId);
    expect(checkGeometry(map, "<svg></svg>")).toHaveLength(4);
  });

  it("reports packages with problems instead of failing the whole registry", () => {
    const broken = clone(tinyScenario) as unknown as Json;
    broken["ruleset"] = "unknown";
    const registry = createScenarioRegistry({
      maps: { "/x/map.json": tinyMap },
      rawAssets: {},
      scenarios: { "/x/scenario.json": broken, "/y/scenario.json": { id: "no-map" } },
      urlAssets: {}
    });
    expect(registry.problems).toHaveLength(2);
    expect(registry.list()).toEqual([]);
    expect(() => registry.require(tinyId)).toThrow("Unknown scenario");
  });

  it("rejects two packages that claim the same scenario id", () => {
    const sources = { maps: { "/a/map.json": tinyMap, "/b/map.json": tinyMap }, rawAssets: Object.fromEntries([...assetPaths].map((path) => [path, () => Promise.resolve("")])), scenarios: { "/a/scenario.json": tinyScenario, "/b/scenario.json": tinyScenario }, urlAssets: {} };
    const registry = createScenarioRegistry(sources);
    expect(registry.problems.map((problem) => problem.message).join("")).toContain("duplicate scenario id");
  });

  it("rejects a missing asset when loading", async () => {
    const registry = createScenarioRegistry({ maps: { "/a/map.json": tinyMap }, rawAssets: { "src/test/fixtures/scenarios/tiny-front/foot.svg": () => Promise.resolve("") }, scenarios: { "/a/scenario.json": tinyScenario }, urlAssets: { "src/test/fixtures/scenarios/tiny-front/geometry.svg": () => Promise.resolve("") } });
    await expect(registry.loadAssets(tinyId)).rejects.toThrow("Missing asset");
  });
});

/** Section 5.10: code contains no scenario-specific identifiers; scenario folders are reached only through the registry. */
describe("no scenario knowledge in code", () => {
  const sourceFiles = (directory: string): string[] =>
    readdirSync(directory).flatMap((entry) => {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) return /scenarios$/.test(path) ? sourceFiles(path).filter((file) => !/scenarios\/[^/]+\//.test(file.replace(/^.*src\/main\//, ""))) : sourceFiles(path);
      return /\.(ts|tsx)$/.test(path) ? [path] : [];
    });

  it("never mentions a faction, territory, city, unit, or region id", () => {
    const ids = new Set<string>();
    for (const summary of testRegistry().list()) {
      const { map, scenario } = testRegistry().require(summary.id);
      for (const collection of [scenario.factions, scenario.territories, scenario.cities, scenario.units, scenario.unitTypes]) {
        for (const item of collection) ids.add(item.id);
      }
      for (const regionId of map.regions.keys()) ids.add(regionId);
    }
    const offenders = sourceFiles("src/main").flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return [...ids].filter((id) => new RegExp(`["'\`]${id}["'\`]`).test(text)).map((id) => `${file}: "${id}"`);
    });
    expect(offenders).toEqual([]);
  });

  it("imports scenario folders only from the built-in source list", () => {
    const offenders = sourceFiles("src/main").filter((file) =>
      !file.endsWith("builtInSources.ts") && /from\s+["'][^"']*scenarios\/[a-z0-9-]+\/[^"']*["']/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
