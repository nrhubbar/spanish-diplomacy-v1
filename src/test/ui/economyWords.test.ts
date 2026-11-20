import { describe, expect, it } from "vitest";
import { initialGameState } from "../../main/engine/resolution";
import type { BuildingEffect, BuildingId, BuildProject, DevelopmentId, FactionId, ResourceId, Resources, Scenario, SubTerritoryId, SubTerritoryState } from "../../main/engine/types";
import {
  amountText,
  buildingEffectText,
  levelsOf,
  projectBaseName,
  projectEffectText,
  projectName,
  projectTerms,
  resourceAmount,
  resourceAmountInFull,
  signed,
  signedAmountText,
  signedResourceAmount,
  turnsLeftText
} from "../../main/presentation/economy";
import { spain } from "../support";

const minus = "\u2212";
const dot = "\u00b7";
const funds = "funds" as ResourceId;
const res = (amount: Readonly<Record<string, number>>): Resources => amount;
const manpower = "manpower" as ResourceId;
const building = (id: string): BuildProject => ({ buildingId: id as BuildingId, kind: "building" });
const development = (id: string): BuildProject => ({ developmentId: id as DevelopmentId, kind: "development" });
const rail: BuildProject = { improvement: "rail", kind: "improvement" };
const port: BuildProject = { improvement: "port", kind: "improvement" };

describe("resource amounts (EB-12)", () => {
  const scenario = spain();

  it("reads amounts through each resource's display", () => {
    expect(resourceAmount(scenario, funds, 42)).toBe("42");
    expect(resourceAmount(scenario, manpower, 18)).toBe("18k");
    expect(resourceAmount(scenario, "gold" as ResourceId, 3)).toBe("3");
    expect(signedResourceAmount(scenario, manpower, 9)).toBe("+9k");
    expect(signedResourceAmount(scenario, funds, -3)).toBe(`${minus}3`);
    expect(signedResourceAmount(scenario, funds, 0)).toBe("+0");
    expect(resourceAmountInFull(scenario, manpower, 18)).toBe("18,000");
    expect(resourceAmountInFull(scenario, manpower, 1234)).toBe("1,234,000");
    expect(resourceAmountInFull(scenario, funds, 42)).toBe("42");
  });

  it("lists amounts, leaving zeros out", () => {
    expect(amountText(scenario, res({ funds: 6, manpower: 3 }))).toBe(`6 Funds ${dot} 3k Manpower`);
    expect(amountText(scenario, res({ funds: 6, manpower: 0 }), ", ")).toBe("6 Funds");
    expect(amountText(scenario, {})).toBe("nothing");
    expect(signedAmountText(scenario, res({ funds: 6, manpower: -1 }))).toBe(`+6 Funds ${dot} ${minus}1k Manpower`);
    expect(signedAmountText(scenario, res({ manpower: 0 }))).toBe("nothing");
    expect(signed(14)).toBe("+14");
    expect(signed(-3)).toBe(`${minus}3`);
    expect(signed(0)).toBe("+0");
  });
});

describe("projects in words ($3-$5)", () => {
  const scenario = spain();
  const state = initialGameState(scenario);
  const madrid = state.subTerritories["madrid" as SubTerritoryId]!;

  it("names each kind of project, or falls back to its id", () => {
    expect(projectBaseName(scenario, building("factory"))).toBe("Factory");
    expect(projectBaseName(scenario, building("mystery"))).toBe("mystery");
    expect(projectBaseName(scenario, development("farms"))).toBe("Farms");
    expect(projectBaseName(scenario, development("orchards"))).toBe("orchards");
    expect(projectBaseName(scenario, rail)).toBe("Rail");
    expect(projectBaseName(scenario, port)).toBe("Port");
  });

  it("names levelled projects with the step they make, after any queued ahead", () => {
    expect(projectName(scenario, madrid, building("factory"))).toBe("Factory");
    expect(projectName(scenario, undefined, development("farms"))).toBe("Farms");
    expect(projectName(scenario, madrid, development("farms"))).toBe("Farms 1 \u2192 2");
    expect(projectName(scenario, madrid, development("mines"))).toBe("Mines 0 \u2192 1");
    expect(projectName(scenario, madrid, rail)).toBe("Rail 3 \u2192 4");
    expect(projectName(scenario, madrid, development("farms"), 2)).toBe("Farms 2 \u2192 3");
    const queued: SubTerritoryState = { ...madrid, queue: [{ factionId: "republic" as FactionId, paid: {}, project: development("farms"), turnsLeft: 3 } as never] };
    expect(projectName(scenario, queued, development("farms"))).toBe("Farms 2 \u2192 3");
  });

  it("says what every building effect does", () => {
    const cases: readonly (readonly [BuildingEffect, string])[] = [
      [{ extra: 1, kind: "recruit-slots" }, "+1 recruit a turn"],
      [{ kind: "replenish-rate", share: 0.25 }, "+25% replenishment"],
      [{ kind: "replenish-cap", share: 0.25 }, "+25% replenishment cap"],
      [{ extra: 1, kind: "rail-departures" }, "+1 rail departure"],
      [{ kind: "airbase" }, "bases aircraft"],
      [{ kind: "all-weather-airbase" }, "flies in Mud and Snow"],
      [{ kind: "defence-roll", roll: 1 }, "+1 defence"]
    ];
    for (const [effect, text] of cases) expect(buildingEffectText(effect)).toBe(text);
  });

  it("says what finishing a project gives", () => {
    expect(projectEffectText(scenario, development("farms"))).toBe("+1k Manpower a turn");
    expect(projectEffectText(scenario, development("mines"))).toBe("+1 Funds a turn");
    expect(projectEffectText(scenario, development("orchards"))).toBeUndefined();
    expect(projectEffectText(scenario, rail)).toBe("longer rail moves");
    expect(projectEffectText(scenario, port)).toMatch(/^lands more (armies|units)$/u);
    expect(projectEffectText(scenario, building("mystery"))).toBeUndefined();
    // Effects first, then what it unlocks, at most three types named.
    expect(projectEffectText(scenario, building("factory"))).toMatch(/^\+1 recruit a turn, recruits Artillery group, Tank company, Truck column\u2026$/u);
    expect(projectEffectText(scenario, building("depot"))).toBe("+25% replenishment cap, recruits Tank company, Truck column");
    expect(projectEffectText(scenario, building("fortifications"))).toBe("+1 defence");
    expect(projectEffectText(scenario, building("barracks"))).toMatch(/^recruits Infantry regiment, Colonial veterans, Security forces\u2026$/u);
  });

  it("names a development track's resource by id when the scenario lacks it", () => {
    const odd: Scenario = { ...scenario, index: { ...scenario.index, development: new Map([...scenario.index.development].map(([id, track]) => [id, id === "farms" ? { ...track, resource: "grain" as ResourceId } : track])) } };
    expect(projectEffectText(odd, development("farms"))).toBe("+1 grain a turn");
    // A building with no effects that unlocks nothing says nothing.
    expect(projectEffectText({ ...scenario, unitTypes: [] }, building("barracks"))).toBeUndefined();
  });

  it("writes a queue option's terms", () => {
    expect(projectTerms(scenario, development("farms"))).toBe(`6 Funds ${dot} 3 turns ${dot} +1k Manpower a turn`);
    expect(projectTerms(scenario, building("mystery"))).toBe("");
    const quick: Scenario = { ...scenario, index: { ...scenario.index, development: new Map([...scenario.index.development].map(([id, track]) => [id, { ...track, upgrade: { ...track.upgrade, turns: 1 } }])) } };
    expect(projectTerms(quick, development("mines"))).toBe(`8 Funds ${dot} 1 turn ${dot} +1 Funds a turn`);
    const bare: Scenario = { ...scenario, unitTypes: [] };
    expect(projectTerms(bare, building("barracks"))).toMatch(/^\d+ Funds .*turns?$/u);
  });

  it("gives levels for pips and turns left", () => {
    expect(levelsOf(scenario, madrid, development("farms"))).toEqual({ level: 1, max: 3 });
    expect(levelsOf(scenario, madrid, building("factory"))).toEqual({ level: 1, max: 1 });
    expect(levelsOf(scenario, madrid, building("fortifications"))).toEqual({ level: 0, max: 1 });
    expect(levelsOf(scenario, madrid, development("orchards"))).toEqual({ level: 0, max: 0 });
    expect(levelsOf(scenario, madrid, rail).level).toBe(3);
    const noImprovements = { ...scenario };
    delete (noImprovements as { improvements?: unknown }).improvements;
    expect(levelsOf(noImprovements, madrid, port)).toEqual({ level: 0, max: 0 });
    expect(turnsLeftText(1)).toBe("1 turn left");
    expect(turnsLeftText(2)).toBe("2 turns left");
  });
});
