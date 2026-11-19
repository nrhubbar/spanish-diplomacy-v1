import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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
const combat = (scenario: Json): Json => scenario["combat"] as Json;
const modifier = (scenario: Json): Json => list(combat(scenario)["factionModifiers"])[0]!;

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
    ["L1 map schema", (_scenario: Json, map: Json) => { map["specVersion"] = 1; }, "specVersion"],
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
    ["L11 missing asset", (_scenario: Json, map: Json) => { (map["geometry"] as Json)["svg"] = "assets/maps/missing.svg"; }, "(L11)"],
    ["L1 unit type without values", (scenario: Json) => { delete list(scenario["unitTypes"])[0]!["attack"]; }, "unitTypes.0.attack"],
    ["L1 zero unit type value", (scenario: Json) => { list(scenario["unitTypes"])[0]!["defence"] = 0; }, "unitTypes.0.defence"],
    ["L1 fractional unit type value", (scenario: Json) => { list(scenario["unitTypes"])[0]!["attack"] = 2.5; }, "unitTypes.0.attack"],
    ["L1 army without strength", (scenario: Json) => { delete list(scenario["units"])[0]!["strength"]; }, "units.0.strength"],
    ["L1 army without full strength", (scenario: Json) => { delete list(scenario["units"])[0]!["fullStrength"]; }, "units.0.fullStrength"],
    ["L1 designation too long", (scenario: Json) => { list(scenario["units"])[0]!["designation"] = "RANGE"; }, "units.0.designation"],
    ["L1 lower-case designation", (scenario: Json) => { list(scenario["units"])[0]!["designation"] = "rr"; }, "units.0.designation"],
    ["L1 retired approximateStrength", (scenario: Json) => { list(scenario["units"])[0]!["approximateStrength"] = 500; }, "approximateStrength"],
    ["L1 missing combat block", (scenario: Json) => { delete scenario["combat"]; }, "combat"],
    ["L1 table with six columns", (scenario: Json) => { list(combat(scenario)["table"]).pop(); }, "combat.table"],
    ["L1 table column with six rows", (scenario: Json) => { (list(combat(scenario)["table"])[3] as unknown as string[]).pop(); }, "combat.table.3"],
    ["L1 unknown result", (scenario: Json) => { (list(combat(scenario)["table"])[2] as unknown as string[])[4] = "attacker-routed"; }, "combat.table.2.4"],
    ["L1 unknown below-1:1 rule", (scenario: Json) => { combat(scenario)["belowOneToOne"] = { kind: "none", rollPenalty: 1 }; }, "combat.belowOneToOne.kind"],
    ["L1 zero digging-in step", (scenario: Json) => { combat(scenario)["diggingIn"] = { max: 3, perTurn: 0 }; }, "combat.diggingIn.perTurn"],
    ["L1 demoralization factor above 1", (scenario: Json) => { combat(scenario)["demoralizationFactor"] = 1.5; }, "combat.demoralizationFactor"],
    ["L1 demoralization factor of 0", (scenario: Json) => { combat(scenario)["demoralizationFactor"] = 0; }, "combat.demoralizationFactor"],
    ["L1 unknown modifier condition", (scenario: Json) => { modifier(scenario)["when"] = "always"; }, "combat.factionModifiers.0.when"],
    ["L1 negative modifier", (scenario: Json) => { modifier(scenario)["defence"] = -1; }, "combat.factionModifiers.0.defence"],
    ["L2 duplicate modifier ids", (scenario: Json) => { list(combat(scenario)["factionModifiers"]).push(clone(modifier(scenario))); }, "combat.factionModifiers: duplicate id \"harbor-batteries\" (L2)"],
    ["L3 army of an unknown type", (scenario: Json) => { list(scenario["units"])[0]!["type"] = "cavalry"; }, "unknown unit type \"cavalry\" (L3)"],
    ["L3 modifier for an unknown faction", (scenario: Json) => { modifier(scenario)["factionId"] = "green"; }, "combat.factionModifiers[0].factionId: unknown faction \"green\" (L3)"],
    ["L12 strength above full strength", (scenario: Json) => { list(scenario["units"])[0]!["strength"] = 501; }, "units[0].strength: 501 men exceeds fullStrength 500 (L12)"],
    ["L13 modifier without effect", (scenario: Json) => { modifier(scenario)["defence"] = 0; }, "(L13)"]
  ])("rejects %s", (_name, mutate, expected) => {
    expect(issuesFor(mutate).join("\n")).toContain(expected);
  });

  it("accepts a full-strength army and a modifier that only helps the attacker", () => {
    expect(issuesFor((scenario) => {
      list(scenario["units"])[1]!["strength"] = 400;
      delete modifier(scenario)["defence"];
      modifier(scenario)["attack"] = 1;
    })).toEqual([]);
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
      // A scenario package folder (it holds a scenario.json) may name its own ids, in its plugin.
      if (statSync(path).isDirectory()) return existsSync(join(path, "scenario.json")) ? [] : sourceFiles(path);
      return /\.(ts|tsx)$/.test(path) ? [path] : [];
    });

  it("never mentions a faction, territory, city, unit, region, or Milestone 3 catalogue id", () => {
    const ids = new Set<string>();
    for (const summary of testRegistry().list()) {
      const { map, scenario } = testRegistry().require(summary.id);
      const systems = [scenario.subTerritories, scenario.resources, scenario.development, scenario.buildings, scenario.generals];
      for (const collection of [scenario.factions, scenario.territories, scenario.cities, scenario.units, scenario.unitTypes, ...systems]) {
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
