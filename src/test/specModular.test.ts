import { describe, expect, it } from "vitest";
import { initialGameState } from "../main/engine/resolution";
import {
  airMissionKinds,
  buildingEffectKinds,
  raidOutcomes,
  ruleAreas,
  terrainKinds,
  traitEffectKinds,
  unitEffectKinds,
  unitKinds,
  unitOrderKinds,
  unitSymbols,
  weatherEffectKinds
} from "../main/engine/types";
import { loadPackage, PackageValidationError, type ScenarioPackage } from "../main/scenarios/loader";
import { checkSubTerritoryMap } from "../main/scenarios/loader/map";
import { entryKinds } from "../main/scenarios/schema/coreSchema";
import { airMissionSchema, buildingEffectSchema, ruleAreaNames, terrainSchema, unitEffectSchema, unitKindSchema, unitOrderKindSchema, unitSymbolSchema } from "../main/scenarios/schema/modularSchema";
import { raidOutcomeSchema, traitEffectSchema, weatherEffectSchema } from "../main/scenarios/schema/systemsSchema";
import { type Json, modularMap, modularScenario } from "./modularFixture";
import { tiny } from "./support";

const assetPaths = new Set(["src/test/fixtures/scenarios/tiny-front/geometry.svg", "src/test/fixtures/scenarios/tiny-front/foot.svg"]);
const list = (value: unknown): Json[] => value as Json[];
const block = (scenario: Json, key: string): Json => scenario[key] as Json;
/** The `@data` of a typed entry (D1). */
const data = (entry: Json): Json => entry["@data"] as Json;

function load(mutate: (scenario: Json) => void = () => undefined): ScenarioPackage {
  const scenario = modularScenario();
  mutate(scenario);
  return loadPackage({ assetPaths, mapDocument: modularMap(), mapPath: "map.json", scenarioDocument: scenario, scenarioPath: "scenario.json" });
}

function issuesFor(mutate: (scenario: Json) => void): string {
  try {
    load(mutate);
    return "";
  } catch (error) {
    if (error instanceof PackageValidationError) return error.issues.join("\n");
    throw error;
  }
}

const kinds = entryKinds;

describe("spec version 2 contract", () => {
  it("keeps the schema's literal lists equal to the engine's", () => {
    expect(ruleAreaNames).toEqual([...ruleAreas]);
    expect(unitOrderKindSchema.options).toEqual([...unitOrderKinds]);
    expect(unitKindSchema.options).toEqual([...unitKinds]);
    expect(unitSymbolSchema.options).toEqual([...unitSymbols]);
    expect(airMissionSchema.options).toEqual([...airMissionKinds]);
    expect(terrainSchema.options).toEqual([...terrainKinds]);
    expect(raidOutcomeSchema.options).toEqual([...raidOutcomes]);
    expect(kinds(unitEffectSchema)).toEqual([...unitEffectKinds]);
    expect(kinds(buildingEffectSchema)).toEqual([...buildingEffectKinds]);
    expect(kinds(weatherEffectSchema)).toEqual([...weatherEffectKinds]);
    expect(kinds(traitEffectSchema)).toEqual([...traitEffectKinds]);
  });

  it("indexes every block of an m3-modular package", () => {
    const { scenario } = load();
    expect(scenario.ruleset).toBe("m3-modular");
    expect(scenario.index.subTerritoriesByTerritory.get(scenario.territories[0]!.id)?.map((sub) => sub.id)).toEqual(["west-town-quarter", "west-hills"]);
    expect(scenario.index.subTerritoryNeighbors.get(scenario.subTerritories[1]!.id)).toEqual(["west-town-quarter", "highlands"]);
    expect(scenario.index.subTerritories.get(scenario.subTerritories[0]!.id)?.cityIds).toEqual(["west-town"]);
    expect(scenario.territories[0]).toMatchObject({ capitalSubTerritoryId: "west-town-quarter", weatherZoneId: "plains" });
    expect(scenario.connections[0]?.entry).toEqual(["west-town-quarter", "highlands"]);
    expect(scenario.factions[0]).toMatchObject({ seatTerritoryId: "westfold", startingStock: { funds: 10, manpower: 5 } });
    expect(scenario.index.generalsByFaction.get(scenario.factions[1]!.id)?.map((general) => general.id)).toEqual(["blue-1", "blue-2", "blue-3"]);
    expect(scenario.ai.profiles[scenario.factions[0]!.id]?.stakes.objective).toBe(5);
    expect(scenario.unitTypes.map((type) => type.kind)).toEqual(["ground", "ground", "air", "general"]);
    expect(scenario.unitTypes[0]?.recruit).toMatchObject({ establishment: 400, requires: [{ buildingId: "barracks", kind: "building" }], trainingTurns: 2 });
    expect(scenario.d20.table[6]?.[20]).toBe("driven-out");
    expect(scenario.weather?.zones[0]?.tables["winter" as never]).toHaveLength(3);
    expect(scenario.buildings.find((building) => building.id === "paved-airfield")?.upgradeOf).toBe("airfield");
    expect(scenario.improvements?.railDamageOnContest).toBe(1);
    expect(scenario.calendar?.start).toEqual({ half: "late", month: 7, year: 1936 });
  });

  it("starts each sub-territory with its start holder and data, and each treasury with its stock (P1, $7)", () => {
    const { scenario } = load();
    const state = initialGameState(scenario);
    expect(state.subTerritories["port-quarter" as never]).toEqual({ buildings: ["barracks"], development: { industry: 2 }, holder: "blue", port: 2, queue: [], rail: 1 });
    expect(state.treasuries["red" as never]).toEqual({ funds: 10, manpower: 5 });
    expect(state.generals["blue" as never]).toEqual({ nextIndex: 0, pending: [] });
    expect(state).toMatchObject({ raidCuts: [], raised: {}, reveals: [], training: [] });
  });

  it("gives a package that selects no optional system none of them (declog D3)", () => {
    const scenario = tiny();
    expect(scenario.rules).toEqual({ air: "none", economy: "none", movement: "single-step", partition: "none", recruitment: "none", weather: "none" });
    expect(scenario.unitTypes[0]).toMatchObject({ effects: [], kind: "ground", orders: ["move"] });
    expect([scenario.subTerritories, scenario.resources, scenario.buildings, scenario.generals]).toEqual([[], [], [], []]);
    expect(initialGameState(scenario)).toMatchObject({ generals: {}, subTerritories: {}, treasuries: {} });
  });
});

describe("m3-modular loader rules", () => {
  it("accepts the modular fixture as written", () => {
    expect(issuesFor(() => undefined)).toBe("");
  });

  it.each([
    ["L1 spec version 1", (s: Json) => { s["specVersion"] = 1; }, "specVersion"],
    ["L1 unknown ruleset", (s: Json) => { s["ruleset"] = "m2-strength"; }, "ruleset"],
    ["L14 unknown module", (s: Json) => { block(s, "rules")["air"] = "zeppelins"; }, "rules.air: unknown air module \"zeppelins\" (L14)"],
    ["L15 missing module data", (s: Json) => { delete s["weather"]; }, "weather: required by the weather module \"seasonal-zones\" (L15)"],
    ["L15 empty sub-territories", (s: Json) => { s["subTerritories"] = []; s["subTerritoryBorders"] = []; }, "subTerritories: required by"],
    ["L16 territory without a capital", (s: Json) => { delete list(s["territories"])[1]!["capitalSubTerritoryId"]; }, "needs a capitalSubTerritoryId (L16)"],
    ["L16 capital in another territory", (s: Json) => { list(s["territories"])[1]!["capitalSubTerritoryId"] = "isle"; }, "is not in \"highlands\" (L16)"],
    ["L16 unknown capital", (s: Json) => { list(s["territories"])[1]!["capitalSubTerritoryId"] = "nowhere"; }, "unknown sub-territory \"nowhere\" (L3)"],
    ["L16 city without a sub-territory", (s: Json) => { delete list(s["cities"])[0]!["subTerritoryId"]; }, "needs a subTerritoryId (L16)"],
    ["L16 city in another territory's sub-territory", (s: Json) => { list(s["cities"])[0]!["subTerritoryId"] = "isle"; }, "is not in \"westfold\" (L16)"],
    ["L16 city in an unknown sub-territory", (s: Json) => { list(s["cities"])[0]!["subTerritoryId"] = "nowhere"; }, "unknown sub-territory"],
    ["L17 air type without range", (s: Json) => { delete list(s["unitTypes"])[2]!["air"]; }, "\"wing\" needs an air block (L17)"],
    ["L17 ground type with range", (s: Json) => { list(s["unitTypes"])[0]!["air"] = { range: 1, missions: ["recon"] }; }, "\"foot\" cannot have an air block (L17)"],
    ["L17 unknown required building", (s: Json) => { block(list(s["unitTypes"])[0]!, "recruit")["requires"] = ["foundry"]; }, "unknown building or development track \"foundry\""],
    ["L17 unknown recruiting faction", (s: Json) => { block(list(s["unitTypes"])[0]!, "recruit")["factionIds"] = ["green"]; }, "unknown faction \"green\""],
    ["L17 unknown weather in an effect", (s: Json) => { data(list(list(s["unitTypes"])[1]!["effects"])[0]!)["exceptWeather"] = ["fog"]; }, "unknown weather outcome \"fog\""],
    ["L18 unknown source", (s: Json) => { list(s["subTerritories"])[5]!["sources"] = [{ sourceId: "rumour" }]; }, "unknown source \"rumour\""],
    ["L18 development above its cap", (s: Json) => { list(s["subTerritories"])[1]!["development"] = { farms: 4 }; }, "level 4 is above 3 (L18)"],
    ["L18 unknown development track", (s: Json) => { list(s["subTerritories"])[1]!["development"] = { vineyards: 1 }; }, "unknown development track"],
    ["L18 city-only track without a city", (s: Json) => { list(s["subTerritories"])[1]!["development"] = { industry: 1 }; }, "needs a city in \"west-hills\" (L18)"],
    ["L18 unknown building", (s: Json) => { list(s["subTerritories"])[1]!["buildings"] = ["castle"]; }, "unknown building \"castle\""],
    ["L18 capital-only building elsewhere", (s: Json) => { list(s["subTerritories"])[1]!["buildings"] = ["palace"]; }, "is built only in a capital (L18)"],
    ["L18 city-only building without a city", (s: Json) => { list(s["subTerritories"])[2]!["buildings"] = ["palace"]; }, "needs a city (L18)"],
    ["L18 upgrade without its base", (s: Json) => { list(s["subTerritories"])[0]!["buildings"] = ["paved-airfield"]; }, "needs \"airfield\" first (L18)"],
    ["L18 building listed twice", (s: Json) => { list(s["subTerritories"])[0]!["buildings"] = ["barracks", "barracks"]; }, "listed twice (L18)"],
    ["L28 link to an unknown sub-territory", (s: Json) => { list(s["links"])[1]!["a"] = "nowhere"; }, "links[1].a: unknown sub-territory \"nowhere\""],
    ["L28 duplicate link", (s: Json) => { list(s["links"]).push(structuredClone(list(s["links"])[1]!)); }, "duplicate link west-town-quarter - west-hills (L28)"],
    ["L28 link off the borders", (s: Json) => { list(s["links"]).push({ a: "isle", b: "highlands", note: "x", modifiers: [] }); }, "isle - highlands is not a sub-territory border (L28)"],
    ["L28 border without a link", (s: Json) => { list(s["links"]).splice(1, 1); }, "west-town-quarter - west-hills has no link (L28)"],
    ["L28 link citing an unknown source", (s: Json) => { list(s["links"])[1]!["sources"] = [{ sourceId: "nope" }]; }, "links[1].sources: unknown source \"nope\""],
    ["L28 modifier listed twice", (s: Json) => { list(list(s["links"])[1]!["modifiers"]).push({ "@type": "road", "@data": { level: "main" } }); }, "\"road\" is listed twice (L28)"],
    ["L28 modifier without rules", (s: Json) => {
      s["linkModifiers"] = list(s["linkModifiers"]).filter((entry) => entry["@type"] !== "pass");
      list(list(s["links"])[1]!["modifiers"]).push({ "@type": "pass", "@data": { name: "Gap" } });
    }, "\"pass\" has no entry in linkModifiers (L28)"],
    ["L28 modifier rules twice", (s: Json) => { list(s["linkModifiers"]).push(structuredClone(list(s["linkModifiers"])[0]!)); }, "linkModifiers: \"road\" is defined twice (L28)"],
    ["L29 unknown buildable", (s: Json) => { (list(s["subTerritories"])[1]!["buildable"] as string[]).push("moat"); }, "unknown building, development track or improvement \"moat\" (L29)"],
    ["L29 buildable listed twice", (s: Json) => { (list(s["subTerritories"])[1]!["buildable"] as string[]).push("rail"); }, "\"rail\" is listed twice (L29)"],
    ["L29 capital-only buildable elsewhere", (s: Json) => { (list(s["subTerritories"])[1]!["buildable"] as string[]).push("palace"); }, "\"palace\" is built only in a capital (L29)"],
    ["L29 city-only buildable without a city", (s: Json) => { (list(s["subTerritories"])[1]!["buildable"] as string[]).push("industry"); }, "\"industry\" needs a city (L29)"],
    ["L18 port above the cap", (s: Json) => { block(block(s, "improvements"), "port")["maxLevel"] = 1; }, "port: above 1 (L18)"],
    ["L19 border to itself", (s: Json) => { list(s["subTerritoryBorders"]).push(["isle", "isle"] as never); }, "cannot border itself (L19)"],
    ["L19 duplicate border", (s: Json) => { list(s["subTerritoryBorders"]).push(["west-hills", "west-town-quarter"] as never); }, "duplicate border west-hills - west-town-quarter (L19)"],
    ["L19 unknown border", (s: Json) => { list(s["subTerritoryBorders"]).push(["isle", "atlantis"] as never); }, "unknown sub-territory \"atlantis\""],
    ["L19 connection without entries", (s: Json) => { delete data(list(s["connections"])[0]!)["entry"]; }, "needs entry sub-territories (L19)"],
    ["L19 entry on the wrong side", (s: Json) => { data(list(s["connections"])[0]!)["entry"] = ["highlands", "west-town-quarter"]; }, "is not in \"westfold\" (L19)"],
    ["L19 unknown entry", (s: Json) => { data(list(s["connections"])[0]!)["entry"] = ["nowhere", "highlands"]; }, "unknown sub-territory \"nowhere\""],
    ["L20 territory without a zone", (s: Json) => { delete list(s["territories"])[0]!["weatherZone"]; }, "needs a weatherZone (L20)"],
    ["L20 unknown zone", (s: Json) => { list(s["territories"])[0]!["weatherZone"] = "tundra"; }, "unknown weather zone \"tundra\""],
    ["L20 seasons miss a month", (s: Json) => { list(block(s, "weather")["seasons"])[0]!["months"] = [4, 5]; }, "cover each month once (L20)"],
    ["L20 zone without a season", (s: Json) => { delete block(list(block(s, "weather")["zones"])[0]!, "tables")["winter"]; }, "missing season \"winter\" (L20)"],
    ["L20 table for an unknown season", (s: Json) => { block(list(block(s, "weather")["zones"])[0]!, "tables")["monsoon"] = [{ outcome: "clear", upTo: 20 }]; }, "unknown season \"monsoon\""],
    ["L20 bands short of 20", (s: Json) => { block(list(block(s, "weather")["zones"])[0]!, "tables")["summer"] = [{ outcome: "clear", upTo: 19 }]; }, "must rise and end at 20 (L20)"],
    ["L20 unknown outcome", (s: Json) => { block(list(block(s, "weather")["zones"])[0]!, "tables")["summer"] = [{ outcome: "fog", upTo: 20 }]; }, "unknown weather outcome \"fog\""],
    ["L21 short roster", (s: Json) => { block(s, "generals")["roster"] = list(block(s, "generals")["roster"]).slice(1); }, "\"red\" has 2 generals; each faction needs 3 to 5 (L21)"],
    ["L21 unknown trait", (s: Json) => { list(block(s, "generals")["roster"])[0]!["trait"] = "lucky"; }, "unknown trait \"lucky\""],
    ["L21 general without a source", (s: Json) => { list(block(s, "generals")["roster"])[0]!["sources"] = [{ sourceId: "rumour" }]; }, "unknown source \"rumour\""],
    ["L21 faction without a seat", (s: Json) => { delete list(s["factions"])[0]!["seatTerritoryId"]; }, "needs a seatTerritoryId (L21)"],
    ["L21 unknown seat", (s: Json) => { list(s["factions"])[0]!["seatTerritoryId"] = "atlantis"; }, "unknown territory \"atlantis\""],
    ["L22 unknown grade", (s: Json) => { (list(block(s, "d20")["table"])[0] as unknown as string[])[0] = "rout"; }, "d20.table[0][0]: unknown grade \"rout\" (L3)"],
    ["L22 fatigue out of order", (s: Json) => { block(block(s, "d20"), "fatigue")["fatiguedLevel"] = 3; }, "fatiguedLevel must be below demoralizedLevel (L22)"],
    ["L22 works step above the cap", (s: Json) => { block(block(s, "d20"), "modifiers")["worksPerTurn"] = 10; }, "worksPerTurn cannot exceed worksMax (L22)"],
    ["L22 d20 modifier for an unknown faction", (s: Json) => { list(block(s, "d20")["factionModifiers"])[0]!["factionId"] = "green"; }, "unknown faction \"green\""],
    ["L23 faction without a profile", (s: Json) => { delete block(block(s, "ai"), "profiles")["red"]; }, "ai.profiles: missing a profile for \"red\" (L23)"],
    ["L27 economy without a Build budget", (s: Json) => { delete block(block(block(s, "ai"), "profiles"), "red")["builds"]; }, "ai.profiles.red: needs a builds budget with the economy module \"development\" (L27)"],
    ["L27 Build budget share above 1", (s: Json) => { block(block(block(block(s, "ai"), "profiles"), "red"), "builds")["spendShare"] = 1.5; }, "spendShare"],
    ["L23 profile for an unknown faction", (s: Json) => { block(block(s, "ai"), "profiles")["green"] = block(block(s, "ai"), "profiles")["red"]; }, "ai.profiles: unknown faction \"green\" (L3)"],
    ["L21 general unit without a roster entry", (s: Json) => { delete list(s["units"])[3]!["generalId"]; }, "is a general and needs a generalId (L21)"],
    ["L21 unknown general", (s: Json) => { list(s["units"])[3]!["generalId"] = "napoleon"; }, "unknown general \"napoleon\""],
    ["L21 general of another faction", (s: Json) => { list(s["units"])[3]!["generalId"] = "blue-1"; }, "serves another faction (L21)"],
    ["L21 general id on a line unit", (s: Json) => { list(s["units"])[0]!["generalId"] = "red-2"; }, "only units of a general type name a generalId (L21)"],
    ["L21 general fielded twice", (s: Json) => { list(s["units"]).push({ ...list(s["units"])[3]!, id: "red-staff-2" }); }, "\"red-1\" is fielded twice (L21)"],
    ["L24 faction without a stock", (s: Json) => { delete list(s["factions"])[0]!["startingStock"]; }, "needs a startingStock (L24)"],
    ["L24 unknown resource", (s: Json) => { list(s["factions"])[0]!["startingStock"] = { gold: 5 }; }, "unknown resource \"gold\""],
    ["L24 track of an unknown resource", (s: Json) => { list(s["development"])[0]!["resource"] = "food"; }, "unknown resource \"food\""],
    ["L3 unknown source behind a block", (s: Json) => { block(s, "d20")["sources"] = [{ sourceId: "rumour" }]; }, "d20.sources: unknown source \"rumour\" (L3)"],
    ["L3 unknown source behind a catalogue entry", (s: Json) => { list(s["buildings"])[0]!["sources"] = [{ sourceId: "rumour" }]; }, "buildings[0].sources: unknown source"],
    ["L3 unknown source behind the AI profiles", (s: Json) => { block(s, "ai")["sources"] = [{ sourceId: "rumour" }]; }, "ai.sources: unknown source"],
    ["L25 raid table short of 20", (s: Json) => { list(block(s, "air")["raidTable"]).pop(); }, "air.raidTable: bands must rise and end at 20 (L25)"]
  ])("rejects %s", (_name, mutate, expected) => {
    expect(issuesFor(mutate)).toContain(expected);
  });

  it("accepts a sea lane beside a land connection (R3), and a package without link works (R7)", () => {
    expect(issuesFor((s) => {
      list(s["connections"]).push({ "@type": "sea", "@data": { between: ["westfold", "highlands"], entry: ["west-town-quarter", "highlands"] } });
      delete s["linkProjects"];
    })).toBe("");
    expect(load((s) => { delete s["linkProjects"]; }).scenario.linkProjects).toBeUndefined();
    expect(load().scenario.linkProjects?.["road-upgrade"]).toEqual({ cost: { funds: 2 }, turns: 1 });
  });

  it("accepts a package that leaves optional systems off", () => {
    expect(issuesFor((s) => {
      block(s, "rules")["weather"] = "none";
      block(s, "rules")["air"] = "none";
      delete s["weather"];
      delete s["air"];
      delete s["generals"];
      s["units"] = list(s["units"]).filter((entry) => entry["generalId"] === undefined);
      for (const territory of list(s["territories"])) delete territory["weatherZone"];
      for (const faction of list(s["factions"])) delete faction["seatTerritoryId"];
      data(list(list(s["unitTypes"])[1]!["effects"])[0]!)["exceptWeather"] = [];
    })).toBe("");
  });
});

describe("map sub-territory entries (L10)", () => {
  const subs = [{ id: "west-hills", territoryId: "westfold" }, { id: "isle", territoryId: "isle" }];

  it("match the scenario's sub-territories one to one, in the same territories", () => {
    expect(checkSubTerritoryMap(subs, { isle: { territoryId: "isle" }, "west-hills": { territoryId: "westfold" } })).toEqual([]);
    expect(checkSubTerritoryMap(subs, { "west-hills": { territoryId: "harbor" }, atlantis: { territoryId: "isle" } })).toEqual([
      "map.subTerritories.entries.west-hills: territory \"harbor\" is not \"westfold\" (L10)",
      "map.subTerritories.entries: missing \"isle\" (L10)",
      "map.subTerritories.entries.atlantis: unknown sub-territory (L10)"
    ]);
  });

  it("indexes a general unit's roster entry (U5)", () => {
    expect(load().scenario.index.units.get("red-staff" as never)?.generalId).toBe("red-1");
  });
});
