import { describe, expect, it } from "vitest";
import { deriveControl } from "../main/engine/control";
import { isContested, holdersIn } from "../main/engine/partition/holders";
import { validateWithdrawOrder } from "../main/engine/partition/orders";
import { exitGround, hasPath, withdrawRoutes } from "../main/engine/partition/paths";
import { arrivalPocket, arrivalSite, pocketOfArmy, pocketsOf } from "../main/engine/partition/pockets";
import { flipWhole, settlePockets, strandedDefenders } from "../main/engine/partition/steps";
import { planWithdrawals } from "../main/ai/orders/withdraw";
import { seededRandom } from "../main/engine/random";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import { retreatDestination, settleDepartures } from "../main/engine/retreat";
import type { BattleOutcome, GameState, Scenario, SubTerritoryId, UnitState, WithdrawOrder } from "../main/engine/types";
import { faction, spainWithAir, territory, unit, withUnits } from "./support";

/**
 * R1 pockets, R2 control flip, and the owner's Revision 2 notes 1 and 14 (from `m3r2-probe`'s
 * `engineBugs.test.ts`). Note 1 is adapted to R3: Málaga's regiment is cut off by land, and its
 * only way out is the sea lane to Murcia.
 */

const sub = (id: string): SubTerritoryId => id as SubTerritoryId;

function holders(state: GameState, changes: Readonly<Record<string, string>>): GameState {
  const subTerritories = { ...state.subTerritories };
  for (const [id, holder] of Object.entries(changes)) {
    const before = subTerritories[sub(id)];
    if (before === undefined) throw new Error(id);
    subTerritories[sub(id)] = { ...before, holder: faction(holder) };
  }
  return { ...state, subTerritories };
}

function storm(state: GameState, scenario: Scenario): GameState {
  const outcomes = Object.fromEntries((scenario.weather?.zones ?? []).map((zone) => [zone.id, "rain"]));
  return { ...state, turnNumber: 11, weather: { outcomes: outcomes as NonNullable<GameState["weather"]>["outcomes"], roll: 15 } };
}

function anchored(state: GameState, id: string, at: string): GameState {
  const army = state.units[unit(id)];
  if (army === undefined) throw new Error(id);
  return { ...state, units: { ...state.units, [army.id]: { ...army, subTerritoryId: sub(at) } } };
}

const withdrawal = (to: string, id = "rep-vitoria-8"): WithdrawOrder => ({ factionId: faction("republic"), from: territory("andalucia"), kind: "withdraw", to: territory(to), unitId: unit(id) });

describe("pockets (R1)", () => {
  const scenario = spainWithAir();
  const start = initialGameState(scenario);

  it("splits a side's ground in contested Andalucía into connected pockets", () => {
    expect(pocketsOf(scenario, start, territory("andalucia"), faction("republic")).map((pocket) => pocket.subTerritoryIds)).toEqual([["malaga"], ["jaen"], ["almeria"]]);
    expect(pocketsOf(scenario, start, territory("andalucia"), faction("south")).map((pocket) => pocket.subTerritoryIds)).toEqual([["sevilla", "cadiz", "huelva", "cordoba", "granada"]]);
    expect(pocketsOf(scenario, start, territory("andalucia"), faction("north"))).toEqual([]);
    // Granada joins Málaga, Jaén and Almería into one pocket.
    expect(pocketsOf(scenario, holders(start, { granada: "republic" }), territory("andalucia"), faction("republic")).map((pocket) => pocket.subTerritoryIds)).toEqual([["granada", "malaga", "jaen", "almeria"]]);
  });

  it("keeps uncontested ground one pocket, islands and all", () => {
    const islands = holders(start, { ibiza: "republic", mallorca: "republic", menorca: "republic" });
    expect(pocketsOf(scenario, islands, territory("islas-baleares"), faction("republic")).map((pocket) => pocket.subTerritoryIds)).toEqual([["mallorca", "menorca", "ibiza"]]);
    // Contested, each island is a pocket of its own.
    expect(pocketsOf(scenario, holders(islands, { mallorca: "south" }), territory("islas-baleares"), faction("republic")).map((pocket) => pocket.subTerritoryIds)).toEqual([["menorca"], ["ibiza"]]);
  });

  it("finds an army's pocket by its stored place, else its city, else its side's first pocket", () => {
    expect(pocketOfArmy(scenario, start, unit("rep-vitoria-8"))?.subTerritoryIds).toEqual(["malaga"]);
    expect(pocketOfArmy(scenario, anchored(start, "rep-vitoria-8", "jaen"), unit("rep-vitoria-8"))?.subTerritoryIds).toEqual(["jaen"]);
    const bare = withUnits(scenario, [["rep-castilla-3", "republic", "andalucia"]]);
    expect(pocketOfArmy(scenario, bare, unit("rep-castilla-3"))?.subTerritoryIds).toEqual(["malaga"]);
    expect(pocketOfArmy(scenario, bare, unit("nobody"))).toBeUndefined();
    // A place in another territory (a city left behind) is no place here.
    const moved = { ...bare, units: { ...bare.units, [unit("rep-castilla-3")]: { ...(bare.units[unit("rep-castilla-3")] as UnitState), cityId: "madrid" as never, subTerritoryId: sub("murcia") } } };
    expect(pocketOfArmy(scenario, moved, unit("rep-castilla-3"))?.subTerritoryIds).toEqual(["malaga"]);
    expect(pocketOfArmy(scenario, withUnits(scenario, [["north-milan-32", "north", "andalucia"]]), unit("north-milan-32"))).toBeUndefined();
  });

  it("puts an arriving army in the pocket on the side of the border it crosses", () => {
    const from = (origin: string): readonly SubTerritoryId[] | undefined => arrivalPocket(scenario, start, territory(origin), territory("andalucia"), faction("republic"))?.subTerritoryIds;
    expect(from("castilla-la-mancha")).toEqual(["jaen"]);
    expect(from("murcia")).toEqual(["almeria"]);
    // Melilla joins Andalucía only by sea, at Málaga.
    expect(from("melilla")).toEqual(["malaga"]);
    expect(arrivalPocket(scenario, start, territory("murcia"), territory("andalucia"), faction("north"))).toBeUndefined();
    expect(arrivalSite(scenario, start.subTerritories, territory("extremadura"), territory("andalucia"), faction("south"))).toBe("sevilla");
  });

  it("lets armies leave only across their own pocket's borders", () => {
    const atJaen = anchored(start, "rep-vitoria-8", "jaen");
    expect(withdrawRoutes(scenario, atJaen, faction("republic"), territory("andalucia"))).toEqual([{ through: ["jaen"], to: "castilla-la-mancha" }]);
    expect(validateWithdrawOrder(scenario, atJaen, withdrawal("castilla-la-mancha"))).toEqual({ ok: true });
    expect(validateWithdrawOrder(scenario, atJaen, withdrawal("murcia"))).toEqual({ ok: false, refusal: { code: "withdraw-no-way-out" } });
    // Two armies in different pockets share no way out.
    const two = { ...atJaen, units: { ...atJaen.units, [unit("rep-castilla-3")]: { ...(atJaen.units[unit("rep-vitoria-8")] as UnitState), id: unit("rep-castilla-3"), subTerritoryId: sub("almeria") } } };
    expect(exitGround(scenario, two, faction("republic"), territory("andalucia"), [unit("rep-vitoria-8"), unit("rep-castilla-3")])).toEqual([]);
    expect(withdrawRoutes(scenario, two, faction("republic"), territory("andalucia"), [unit("rep-castilla-3")])).toEqual([{ through: ["almeria"], to: "murcia" }]);
    // Without armies there, every sub-territory the side holds counts (no pocket to judge by).
    expect(exitGround(scenario, withUnits(scenario, []), faction("republic"), territory("andalucia"))).toEqual(["malaga", "jaen", "almeria"]);
    // An army that is not in the territory is not counted.
    expect(hasPath(scenario, start, faction("republic"), territory("andalucia"), territory("castilla-la-mancha"), [unit("rep-wad-ras-1")])).toBe(false);
  });
});

describe("note 1: the Málaga regiment is cut off by land (R1, R3)", () => {
  const scenario = spainWithAir();
  const state = initialGameState(scenario);

  it("offers no land way out of Andalucía, only the sea lane to Murcia", () => {
    expect(state.units[unit("rep-vitoria-8")]?.cityId).toBe("malaga");
    expect(withdrawRoutes(scenario, state, faction("republic"), territory("andalucia"))).toEqual([{ through: ["malaga"], to: "murcia" }]);
  });

  it("refuses a Withdraw through enemy ground, and by sea when the storms close it", () => {
    expect(validateWithdrawOrder(scenario, state, withdrawal("castilla-la-mancha"))).toEqual({ ok: false, refusal: { code: "withdraw-no-way-out" } });
    expect(validateWithdrawOrder(scenario, state, withdrawal("murcia"))).toEqual({ ok: true });
    expect(validateWithdrawOrder(scenario, storm(state, scenario), withdrawal("murcia"))).toEqual({ ok: false, refusal: { code: "sea-closed" } });
  });

  it("retreats by sea to Murcia, and surrenders when the sea is closed", () => {
    const staying = Object.values(state.units).filter((entry) => entry.id !== "rep-vitoria-8");
    expect(retreatDestination(scenario, state, staying, faction("republic"), territory("andalucia"), unit("rep-vitoria-8"))).toBe("murcia");
    expect(retreatDestination(scenario, storm(state, scenario), staying, faction("republic"), territory("andalucia"), unit("rep-vitoria-8"))).toBeUndefined();
  });
});

describe("note 14: one side alone in a territory holds it uncontested (R2)", () => {
  const scenario = spainWithAir();
  const state = withUnits(scenario, [
    ["south-granada-6", "south", "andalucia"], ["south-lepanto-5", "south", "andalucia"],
    ["rep-vitoria-8", "republic", "andalucia"]
  ]);

  it("hands Andalucía to the South when the Republic withdraws its only army", () => {
    const result = resolveTurn(scenario, state, [{ factionId: faction("republic"), orders: [withdrawal("murcia")] }], 1, () => () => 0.5);
    expect(result.finalState.units[unit("rep-vitoria-8")]?.territoryId).toBe("murcia");
    expect(holdersIn(scenario, result.finalState.subTerritories, territory("andalucia"))).toEqual(["south"]);
    expect(isContested(scenario, result.finalState, territory("andalucia"))).toBe(false);
    expect(result.outcomes).toContainEqual({ factionId: "south", kind: "territory-flipped", subTerritoryIds: ["malaga", "jaen", "almeria"], territoryId: "andalucia" });
  });

  it("leaves Andalucía uncontested after a standing battle destroys the attacker", () => {
    // Sweep a constant die until the standing battle in Andalucía destroys the attacker (the South).
    let found: ReturnType<typeof resolveTurn> | undefined;
    for (let value = 0; value < 1 && found === undefined; value += 0.01) {
      const result = resolveTurn(scenario, state, [], 1, () => () => value);
      const battle = result.outcomes.find((outcome): outcome is BattleOutcome => outcome.kind === "battle" && "territoryId" in outcome.site && outcome.site.territoryId === "andalucia");
      if (battle !== undefined && battle.grade === "attacker-destroyed") found = result;
    }
    expect(found).toBeDefined();
    if (found === undefined) return;
    const southLeft = Object.values(found.finalState.units).filter((entry) => entry.factionId === "south" && entry.territoryId === "andalucia");
    expect(southLeft).toEqual([]);
    expect(isContested(scenario, found.finalState, territory("andalucia"))).toBe(false);
    expect(holdersIn(scenario, found.finalState.subTerritories, territory("andalucia"))).toEqual(["republic"]);
  });

  it("does not count aircraft, and keeps the holders where nobody stands", () => {
    const start = initialGameState(scenario);
    const bomber = start.units[unit("south-ju52-bombers")];
    const regiment = start.units[unit("rep-vitoria-8")];
    if (bomber === undefined || regiment === undefined) throw new Error("units");
    const flipped = flipWhole(scenario, start, { [bomber.id]: bomber, [regiment.id]: regiment }, start.subTerritories);
    expect(flipped.events).toEqual([{ factionId: "republic", kind: "territory-flipped", subTerritoryIds: ["sevilla", "cadiz", "huelva", "cordoba", "granada"], territoryId: "andalucia" }]);
    expect(flipWhole(scenario, start, { [bomber.id]: bomber }, start.subTerritories).changes).toEqual([]);
    expect(flipWhole(scenario, start, {}, start.subTerritories).holdings).toBe(start.subTerritories);
  });

  it("flips a lone side's territory whole without sub-territories too, aircraft aside (M6)", () => {
    const start = initialGameState(scenario);
    const bomber = start.units[unit("south-ju52-bombers")];
    const regiment = start.units[unit("rep-vitoria-8")];
    if (bomber === undefined || regiment === undefined) throw new Error("units");
    const derived = deriveControl(scenario, start, { [bomber.id]: bomber, [regiment.id]: regiment });
    expect(derived.control[territory("andalucia")]).toEqual({ factionId: "republic", kind: "controlled" });
    expect(deriveControl(scenario, start, { [bomber.id]: bomber }).control[territory("andalucia")]).toEqual(start.control[territory("andalucia")]);
    // A side already holding the territory keeps it as it was.
    const held: GameState = { ...start, control: { ...start.control, [territory("andalucia")]: { factionId: faction("republic"), kind: "controlled" } } };
    expect(deriveControl(scenario, held, { [regiment.id]: regiment }).control[territory("andalucia")]).toBe(held.control[territory("andalucia")]);
  });
});

describe("armies in their pockets through the turn (R1)", () => {
  const scenario = spainWithAir();
  const start = initialGameState(scenario);
  const regiment = start.units[unit("rep-vitoria-8")] as UnitState;

  it("strands an army whose pocket fell, though its side holds another pocket", () => {
    const result = { battleIndex: 0, gainer: faction("south"), ground: 1 as const, losers: new Set([faction("republic")]), origins: [territory("andalucia")], territoryId: territory("andalucia") };
    const lost = holders(start, { malaga: "south" }).subTerritories;
    expect(strandedDefenders(scenario, start, start.units, lost, [result], [])).toEqual([{ from: "andalucia", kind: "retreat", report: { battleIndex: 0 }, unitId: "rep-vitoria-8" }]);
    // At Jaén, the same loss leaves it in its pocket.
    const atJaen = anchored(start, "rep-vitoria-8", "jaen");
    expect(strandedDefenders(scenario, atJaen, atJaen.units, lost, [result], [])).toEqual([]);
    // It retreats out of its own pocket: by sea from Málaga to Murcia.
    const settled = settleDepartures(scenario, start, start.units, [{ from: territory("andalucia"), kind: "retreat", report: { battleIndex: 0 }, unitId: regiment.id }]);
    expect(settled.armies[regiment.id]?.territoryId).toBe("murcia");
  });

  it("places an arriving army in the pocket by the border it crossed", () => {
    const arrived = { ...start.units, [unit("rep-castilla-3")]: { ...regiment, id: unit("rep-castilla-3"), territoryId: territory("andalucia") } };
    const moved = { ...start, units: { ...start.units, [unit("rep-castilla-3")]: { ...regiment, id: unit("rep-castilla-3"), territoryId: territory("castilla-la-mancha") } } };
    const settled = settlePockets(scenario, moved, arrived, start.subTerritories);
    expect(settled.armies[unit("rep-castilla-3")]?.subTerritoryId).toBe("jaen");
    // A staged move counts from its last step.
    const staged = settlePockets(scenario, moved, arrived, start.subTerritories, new Map([[unit("rep-castilla-3"), territory("murcia")]]));
    expect(staged.armies[unit("rep-castilla-3")]?.subTerritoryId).toBe("almeria");
    // The Málaga regiment's city already places it: nothing is stored.
    expect(settled.armies[regiment.id]).toBe(regiment);
    expect(settled.events).toEqual([]);
  });

  it("reports a pocket cut in two and keeps each army in its own part", () => {
    const joined = anchored(holders(start, { granada: "republic" }), "rep-vitoria-8", "jaen");
    const armies = { ...joined.units, [unit("rep-castilla-3")]: { ...regiment, id: unit("rep-castilla-3"), subTerritoryId: sub("malaga") } };
    const begun = { ...joined, units: armies };
    const settled = settlePockets(scenario, begun, armies, start.subTerritories);
    expect(settled.armies[unit("rep-vitoria-8")]?.subTerritoryId).toBe("jaen");
    expect(settled.armies[unit("rep-castilla-3")]?.subTerritoryId).toBe("malaga");
    expect(settled.events).toEqual([
      { factionId: "republic", kind: "pocket-cut", subTerritoryIds: ["malaga"], territoryId: "andalucia", unitIds: ["rep-castilla-3"] },
      { factionId: "republic", kind: "pocket-cut", subTerritoryIds: ["jaen"], territoryId: "andalucia", unitIds: ["rep-vitoria-8"] }
    ]);
  });

  it("moves an army whose place was lost to the part of its pocket left, and drops the place in uncontested ground", () => {
    const joined = anchored(holders(start, { granada: "republic" }), "rep-vitoria-8", "granada");
    const settled = settlePockets(scenario, joined, joined.units, start.subTerritories);
    expect(settled.armies[regiment.id]?.subTerritoryId).toBe("malaga");
    const whole = holders(start, { cadiz: "republic", cordoba: "republic", granada: "republic", huelva: "republic", sevilla: "republic" }).subTerritories;
    const placed = anchored(start, "rep-vitoria-8", "jaen");
    expect(settlePockets(scenario, placed, placed.units, whole).armies[regiment.id]?.subTerritoryId).toBeUndefined();
  });

  it("leaves the place alone where nothing is known or nothing is left", () => {
    // A side with armies but no ground there, an army new to the board, a pocket lost whole.
    const thirds = holders(start, { jaen: "north" });
    const stranger = { ...regiment, factionId: faction("north"), id: unit("north-milan-32") };
    const fresh = { ...regiment, id: unit("rep-new-column") };
    const armies = { ...start.units, [stranger.id]: stranger, [fresh.id]: fresh };
    const lost = holders(start, { malaga: "south" });
    const settled = settlePockets(scenario, { ...thirds, units: { ...start.units, [stranger.id]: { ...stranger, subTerritoryId: sub("jaen") } } }, armies, lost.subTerritories);
    expect(settled.armies[stranger.id]).toBe(stranger);
    expect(settled.armies[fresh.id]).toBe(fresh);
    expect(settled.armies[regiment.id]).toBe(regiment);
    expect(settled.events).toEqual([]);
    expect(exitGround(scenario, withUnits(scenario, [["north-milan-32", "north", "andalucia"]]), faction("north"), territory("andalucia"))).toEqual([]);
    expect(arrivalSite(scenario, start.subTerritories, territory("nowhere"), territory("andalucia"), faction("republic"))).toBe("malaga");
  });

  it("has the computer player withdraw each army out of its own pocket only", () => {
    const shaken = { demoralized: true, quietTurns: 0 };
    const base = withUnits(scenario, [["rep-vitoria-8", "republic", "andalucia"], ["rep-castilla-3", "republic", "andalucia"], ["south-granada-6", "south", "andalucia"], ["south-africa-vanguard", "south", "andalucia"]]);
    const placed = anchored(anchored(base, "rep-vitoria-8", "malaga"), "rep-castilla-3", "jaen");
    const tired = { ...placed, units: Object.fromEntries(Object.entries(placed.units).map(([id, entry]) => [id, entry.factionId === "republic" ? { ...entry, morale: shaken } : entry])) } as GameState;
    // The storms close Málaga's sea lane; the Jaén column still has its road out.
    const orders = planWithdrawals({ factionId: faction("republic"), memory: {}, planned: [], random: seededRandom(1), scenario, state: storm(tired, scenario) });
    expect(orders).toEqual([withdrawal("castilla-la-mancha", "rep-castilla-3")]);
  });

  it("weighs two enemy sides of equal attack against each other, the first by id attacking", () => {
    // A South and a North regiment of the same type in Andalucía: the North, first by id, would attack.
    const state = withUnits(scenario, [["rep-vitoria-8", "republic", "andalucia"], ["south-granada-6", "south", "andalucia"], ["north-aragon-17", "north", "andalucia"]]);
    const orders = planWithdrawals({ factionId: faction("republic"), memory: {}, planned: [], random: seededRandom(1), scenario, state });
    expect(orders.every((entry) => entry.to === "murcia")).toBe(true);
  });
});
