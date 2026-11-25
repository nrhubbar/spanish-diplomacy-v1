import { describe, expect, it } from "vitest";
import { incomeFor } from "../main/engine/economy/income";
import { meetsRequirement, recruitSlots, typeLock } from "../main/engine/recruitment/rules";
import { requirementName } from "../main/presentation/refusals";
import { initialGameState } from "../main/engine/resolution";
import type { BuildingId, DevelopmentId, FactionId, GameState, RecruitRequirement, ResourceId, SubTerritoryId, UnitTypeId } from "../main/engine/types";
import { loadPackage } from "../main/scenarios/loader";
import { projectEffectText } from "../main/presentation/economy";
import { faction, said, spain, territory } from "./support";
import { modularMap, modularScenario } from "./modularFixture";

type Json = Record<string, unknown>;

/** D3: the merged Factory: one development track for money, Recruit orders and what needs a Factory. */

const scenario = spain();
const start = initialGameState(scenario);
const factory: RecruitRequirement = { developmentId: "factory" as DevelopmentId, kind: "development" };
const sub = (id: string): SubTerritoryId => id as SubTerritoryId;

function withSites(state: GameState, change: (id: SubTerritoryId, site: GameState["subTerritories"][SubTerritoryId]) => GameState["subTerritories"][SubTerritoryId]): GameState {
  return { ...state, subTerritories: Object.fromEntries(Object.entries(state.subTerritories).map(([id, site]) => [id, change(id as SubTerritoryId, site)])) };
}

describe("the Factory's starting sites (D3)", () => {
  const funds = (state: GameState, id: FactionId): number => incomeFor(scenario, state, id).paid["funds" as ResourceId] ?? 0;
  const held = (id: string, owner: FactionId): GameState => withSites(start, (site, value) => (scenario.index.subTerritories.get(site)?.territoryId === id ? { ...value, holder: owner } : value));

  it("pays each side an opening income within 1 Fund of the Rev 5 yields, and the South 16.5 with Andalucía clear", () => {
    expect(Math.abs(funds(start, faction("republic")) - 21.75)).toBeLessThanOrEqual(1);
    expect(Math.abs(funds(start, faction("north")) - 9)).toBeLessThanOrEqual(1);
    expect(Math.abs(funds(start, faction("south")) - 1.5)).toBeLessThanOrEqual(1);
    const clear = held("andalucia", faction("south"));
    expect(Math.abs(funds({ ...clear, control: { ...clear.control, [territory("andalucia")]: { factionId: faction("south"), kind: "controlled" } } }, faction("south")) - 16.5)).toBeLessThanOrEqual(1);
  });

  it("puts level 2 in Barcelona and Bizkaia, level 1 in the other sites, and none in Alicante or Málaga", () => {
    const level = (id: string): number => scenario.index.subTerritories.get(sub(id))?.development["factory" as DevelopmentId] ?? 0;
    expect(["barcelona", "bizkaia"].map(level)).toEqual([2, 2]);
    const others = scenario.subTerritories.filter((entry) => level(entry.id) > 0 && !["barcelona", "bizkaia"].includes(entry.id));
    expect(others.map((entry) => level(entry.id)).every((value) => value === 1)).toBe(true);
    expect(others).toHaveLength(13);
    expect(["alicante", "malaga"].map(level)).toEqual([0, 0]);
  });

  it("is built only where there is a city, and gives every site it starts with a note", () => {
    for (const entry of scenario.subTerritories.filter((item) => item.buildable.includes("factory" as DevelopmentId))) expect(entry.cityIds.length).toBeGreaterThan(0);
    for (const entry of scenario.subTerritories.filter((item) => (item.development["factory" as DevelopmentId] ?? 0) > 0)) expect(entry.basis.note).toMatch(/Factory/u);
  });
});

describe("a requirement that names a development track (D3, R3)", () => {
  const artillery = scenario.index.unitTypes.get("artillery-group" as UnitTypeId);
  const asturias = territory("asturias");
  const heldWhole = (id: string, owner: FactionId, levels: Readonly<Record<string, number>>): GameState => withSites(start, (site, value) => (scenario.index.subTerritories.get(site)?.territoryId === id
    ? { ...value, development: { ...value.development, factory: levels[site] ?? 0 } as GameState["subTerritories"][SubTerritoryId]["development"], holder: owner }
    : value));

  it("is met by level 1 in any sub-territory of the territory the recruiter holds", () => {
    const republic = faction("republic");
    expect(meetsRequirement(scenario, heldWhole("asturias", republic, {}), republic, asturias, factory)).toBe(false);
    expect(meetsRequirement(scenario, heldWhole("asturias", republic, { asturias: 1 }), republic, asturias, factory)).toBe(true);
    expect(meetsRequirement(scenario, heldWhole("asturias", republic, { oviedo: 3 }), republic, asturias, factory)).toBe(true);
    expect(meetsRequirement(scenario, heldWhole("asturias", faction("north"), { asturias: 1 }), republic, asturias, factory)).toBe(false);
  });

  it("is a building's in the capital only", () => {
    const barracks: RecruitRequirement = { buildingId: "barracks" as BuildingId, kind: "building" };
    expect(meetsRequirement(scenario, start, faction("north"), territory("galicia"), barracks)).toBe(true);
    expect(requirementName(scenario, barracks)).toBe("Barracks");
    expect(requirementName(scenario, factory)).toBe("Factory");
  });

  it("names the missing building and track by place in one reason", () => {
    expect(artillery).toBeDefined();
    if (artillery === undefined) return;
    const lock = typeLock(scenario, withSites(heldWhole("asturias", faction("republic"), {}), (_, site) => ({ ...site, buildings: [] })), faction("republic"), asturias, artillery);
    expect(lock.missing).toEqual([{ buildingId: "barracks", kind: "building" }, factory]);
    expect(said(scenario, lock.refusals[0])).toBe("Needs a Barracks in Oviedo and a Factory in Asturias.");
    const only = typeLock(scenario, withSites(heldWhole("asturias", faction("republic"), { asturias: 1 }), (_, site) => ({ ...site, buildings: [] })), faction("republic"), asturias, artillery);
    expect(said(scenario, only.refusals[0])).toBe("Needs a Barracks in Oviedo.");
  });

  it("gives one more Recruit order for every level in the territory", () => {
    expect(recruitSlots(scenario, heldWhole("asturias", faction("republic"), { asturias: 2, oviedo: 1 }), asturias)).toBe(5);
    expect(recruitSlots(scenario, heldWhole("asturias", faction("republic"), {}), asturias)).toBe(2);
  });

  it("says what a level gives", () => {
    expect(projectEffectText(scenario, factory)).toBe("+2.3 Funds a turn, +1 Recruit order a turn, recruits Artillery group, Tank company");
  });
});

describe("the loader's checks of the merged catalogue (D3)", () => {
  const paths = new Set(["src/test/fixtures/scenarios/tiny-front/geometry.svg", "src/test/fixtures/scenarios/tiny-front/foot.svg"]);
  const problems = (change: (document: Json) => void): string => {
    const document = structuredClone(modularScenario());
    change(document);
    try {
      loadPackage({ assetPaths: paths, mapDocument: modularMap(), mapPath: "m", scenarioDocument: document, scenarioPath: "s" });
      return "";
    } catch (error) {
      return String(error);
    }
  };
  const tracks = (document: Json): { id: string }[] => document["development"] as { id: string }[];
  const recruited = (document: Json): { requires?: string[] } => (document["unitTypes"] as { recruit?: { requires?: string[] } }[]).find((type) => type.recruit !== undefined)?.recruit ?? {};

  it("refuses a building and a track with one id, and a requirement nothing defines", () => {
    expect(problems((document) => { tracks(document).push({ ...tracks(document)[0], id: "barracks" }); })).toContain("\"barracks\" is also a building id (L2)");
    expect(problems((document) => { recruited(document).requires = ["nowhere"]; })).toContain("nowhere");
  });

  it("accepts a requirement that names a track", () => {
    expect(problems((document) => { recruited(document).requires = ["industry"]; })).toBe("");
  });
});
