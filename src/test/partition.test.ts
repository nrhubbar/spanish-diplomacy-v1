import { describe, expect, it } from "vitest";
import { attackDistances, flipOrder, groundTaken } from "../main/engine/partition/flips";
import { applyGround } from "../main/engine/partition/steps";
import { controlFromHolders, holdersIn, isContested } from "../main/engine/partition/holders";
import { contestedReasons, partitionRetreatAllowed, validateWithdrawOrder } from "../main/engine/partition/orders";
import { withdrawRoutes } from "../main/engine/partition/paths";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import { settleDepartures } from "../main/engine/retreat";
import type { FactionId, GameState, SubTerritoryId, WithdrawOrder } from "../main/engine/types";
import { validateMoveOrder, validateOrder } from "../main/engine/validation";
import { victoryProgress } from "../main/engine/victory";
import { type Json } from "./modularFixture";
import { faction, loadedDice, move, spain, spainWithAir, territory, unit, withUnits } from "./support";

const sub = (id: string): SubTerritoryId => id as SubTerritoryId;

function withdrawal(factionId: string, unitId: string, from: string, to: string): WithdrawOrder {
  return { factionId: faction(factionId), from: territory(from), kind: "withdraw", to: territory(to), unitId: unit(unitId) };
}

function holding(state: GameState, id: string): FactionId | undefined {
  return state.subTerritories[sub(id)]?.holder;
}

describe("control from sub-territory holders (P1, W6, P7)", () => {
  it("starts Pais Vasco and Extremadura contested, as their holders say", () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    expect(state.control[territory("pais-vasco")]).toEqual({ factionIds: ["republic", "north"], kind: "contested" });
    expect(state.control[territory("extremadura")]).toEqual({ factionIds: ["republic", "north"], kind: "contested" });
    expect(isContested(scenario, state, territory("andalucia"))).toBe(true);
    expect(isContested(scenario, state, territory("madrid"))).toBe(false);
    // The derivation agrees with the scenario's start everywhere (L26).
    expect(controlFromHolders(scenario, state.subTerritories, state)).toEqual({ cityControl: state.cityControl, control: state.control });
  });

  it("counts a territory toward victory only when one faction holds all of it (P7)", () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    const south = victoryProgress(scenario, state).find((entry) => entry.factionId === "south");
    // Ceuta and Melilla only: Andalucia and the Baleares are contested.
    expect(south?.territoriesControlled).toBe(2);
  });
});

describe("which ground falls first (P4)", () => {
  it("takes the losers' ground nearest the attack's origin first and the capital last", () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    const order = flipOrder(scenario, state.subTerritories, territory("andalucia"), new Set([faction("south")]), attackDistances(scenario, territory("andalucia"), [territory("murcia")]));
    expect(order.at(-1)).toBe("sevilla");
    expect(order[0]).toBe("granada");
    // A land attack from Murcia is measured over land: Malaga's sea lane does not bring Cadiz
    // level with Cordoba (D5), so Cordoba falls before Cadiz.
    expect(order.slice(0, 2)).toEqual(["granada", "cordoba"]);
    expect(order.indexOf(sub("cordoba"))).toBeLessThan(order.indexOf(sub("cadiz")));
  });

  it("measures an attack from across the sea from the landing port (D5)", () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    // Ceuta has no land connection to Andalucia: the Strait lands at Cadiz.
    const order = flipOrder(scenario, state.subTerritories, territory("andalucia"), new Set([faction("south")]), attackDistances(scenario, territory("andalucia"), [territory("ceuta")]));
    expect(order[0]).toBe("cadiz");
    expect(new Set(order)).toEqual(new Set(["sevilla", "cadiz", "huelva", "cordoba", "granada"]));
  });

  it("takes nothing on a partial grade where the territory has one sub-territory (P5)", () => {
    const scenario = spain();
    expect(groundTaken(scenario, territory("murcia"), [sub("murcia")], 1)).toEqual([]);
    expect(groundTaken(scenario, territory("murcia"), [sub("murcia")], "all")).toEqual(["murcia"]);
    expect(groundTaken(scenario, territory("andalucia"), [sub("granada"), sub("cordoba"), sub("sevilla")], 2)).toEqual(["granada", "cordoba"]);
  });
});

describe("battle ground (P4, P5)", () => {
  it("flips a d20 grade's partial ground outer-first, and the whole territory on 'all'", () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    const result = { battleIndex: 3, gainer: faction("republic"), losers: new Set([faction("south")]), origins: [territory("murcia")], territoryId: territory("andalucia") };
    const two = applyGround(scenario, state.subTerritories, [{ ...result, ground: 2 }]);
    // A land attack is measured over land: Málaga's sea lane (R3) does not bring Cádiz level with Córdoba (D5).
    expect(two.changes.map((change) => [change.subTerritoryId, change.cause, change.battleIndex])).toEqual([["granada", "battle", 3], ["cordoba", "battle", 3]]);
    const all = applyGround(scenario, state.subTerritories, [{ ...result, ground: "all" }]);
    expect(holdersIn(scenario, all.holdings, territory("andalucia"))).toEqual(["republic"]);
  });
});

describe("occupation and the sweep (P3)", () => {
  it("takes a whole enemy territory with no army in it at once", () => {
    const scenario = spain();
    const state = withUnits(scenario, [["rep-santander-column", "republic", "cantabria"]]);
    const result = resolveTurn(scenario, state, [{ factionId: faction("republic"), orders: [move("republic", "rep-santander-column", "cantabria", "castilla-y-leon")] }], 1);
    expect(result.finalState.control[territory("castilla-y-leon")]).toEqual({ factionId: "republic", kind: "controlled" });
    expect(result.subTerritoryChanges).toHaveLength(9);
    expect(result.subTerritoryChanges.every((change) => change.cause === "occupation")).toBe(true);
    expect(result.finalState.cityControl["burgos" as never]).toBe("republic");
  });

  it("flips contested ground whole where one side alone has ground armies (R2)", () => {
    const scenario = spain();
    const state = withUnits(scenario, [["rep-castilla-3", "republic", "extremadura"], ["rep-vitoria-8", "republic", "andalucia"]]);
    const first = resolveTurn(scenario, state, [], 1);
    const swept = first.subTerritoryChanges.filter((change) => change.cause === "sweep").map((change) => change.subTerritoryId);
    expect(swept).toEqual(["caceres", "sevilla", "cadiz", "huelva", "cordoba", "granada"]);
    expect(holding(first.finalState, "caceres")).toBe("republic");
    expect(first.finalState.control[territory("extremadura")]).toEqual({ factionId: "republic", kind: "controlled" });
    // Andalucia falls whole in one turn, the capital with it.
    expect(holdersIn(scenario, first.finalState.subTerritories, territory("andalucia"))).toEqual(["republic"]);
    expect(first.outcomes.filter((outcome) => outcome.kind === "territory-flipped")).toEqual([
      { factionId: "republic", kind: "territory-flipped", subTerritoryIds: ["caceres"], territoryId: "extremadura" },
      { factionId: "republic", kind: "territory-flipped", subTerritoryIds: ["sevilla", "cadiz", "huelva", "cordoba", "granada"], territoryId: "andalucia" }
    ]);
  });

  it("does not flip where a territory-level garrison stands: C\u00e1ceres, \u00c1lava, Mallorca, Ibiza and Menorca (D23)", () => {
    // Units stand in a territory, not a sub-territory, so a garrison anywhere in Extremadura
    // defends C\u00e1ceres: the faction there is not alone, and the turn is a standing battle.
    const scenario = spain();
    const start = initialGameState(scenario);
    const garrisons = [["extremadura", "north-argel-27"], ["islas-baleares", "south-palma-36"], ["islas-baleares", "rep-baleares-37"], ["pais-vasco", "north-flandes-5"]] as const;
    for (const [territoryId, unitId] of garrisons) expect(start.units[unit(unitId)]?.territoryId).toBe(territoryId);
    // Dice that leave every standing battle's sides in place, so only the sweep rule is tested.
    const swept = (state: GameState): readonly string[] => resolveTurn(scenario, state, [], 1, loadedDice([8, 8, 11, 11, 11, 11])).subTerritoryChanges
      .filter((change) => change.cause === "sweep")
      .map((change) => change.subTerritoryId);
    expect(swept(start).filter((id) => ["caceres", "alava", "mallorca", "ibiza", "menorca"].includes(id))).toEqual([]);
    // Without the C\u00e1ceres garrison, the Republic's regiment at Badajoz sweeps it on turn 1.
    const ungarrisoned = { ...start, units: Object.fromEntries(Object.entries(start.units).filter(([id]) => id !== "north-argel-27")) };
    expect(swept(ungarrisoned)).toContain("caceres");
    // Without the Mah\u00f3n regiment, Palma No. 36 stands alone in the Balearics and sweeps Menorca.
    const noMahon = { ...start, units: Object.fromEntries(Object.entries(start.units).filter(([id]) => id !== "rep-baleares-37")) };
    expect(swept(noMahon)).toContain("menorca");
  });
});

describe("contested ground orders (C1) and the path rule (P6)", () => {
  it("refuses a move out of contested ground but offers Withdraw through own ground", () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    // R1, R5: Malaga's pocket has no land link to Murcia, so the route check refuses before C1 does.
    expect(validateMoveOrder(scenario, state, move("republic", "rep-vitoria-8", "andalucia", "murcia")).ok).toBe(false);
    expect(validateMoveOrder(scenario, state, move("republic", "rep-asturian-militia", "asturias", "cantabria"))).toEqual({ ok: false, reason: contestedReasons.move });
    expect(validateOrder(scenario, state, withdrawal("republic", "rep-vitoria-8", "andalucia", "murcia"))).toEqual({ ok: true });
    // R1, D5: the Malaga regiment's pocket is Malaga alone; its only way out is the sea lane.
    expect(withdrawRoutes(scenario, state, faction("republic"), territory("andalucia"))).toEqual([{ through: ["malaga"], to: "murcia" }]);
    expect(validateMoveOrder(scenario, state, move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha"))).toEqual({ ok: true });
  });

  it("cuts off the Oviedo pocket: no withdrawal and no retreat (Q-PART-2 rule 2)", () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    expect(withdrawRoutes(scenario, state, faction("north"), territory("asturias"))).toEqual([]);
    expect(validateWithdrawOrder(scenario, state, withdrawal("north", "north-milan-32", "asturias", "galicia"))).toEqual({ ok: false, reason: contestedReasons.withdrawNoPath });
    expect(partitionRetreatAllowed({ factionId: faction("north"), from: territory("asturias"), scenario, state, to: territory("galicia") })).toBe(false);
    const settled = settleDepartures(scenario, state, state.units, [{ from: territory("asturias"), kind: "retreat", report: { battleIndex: 0 }, unitId: unit("north-milan-32") }]);
    expect(settled.settled[0]?.kind).toBe("surrendered");
  });

  it("lets Ceuta's garrison retreat across the strait to its own Cadiz", () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    expect(partitionRetreatAllowed({ factionId: faction("south"), from: territory("ceuta"), scenario, state, to: territory("andalucia") })).toBe(true);
  });

  it("carries a Withdraw out after the battles, reported as withdrawn", () => {
    const scenario = spain();
    const state = withUnits(scenario, [["rep-vitoria-8", "republic", "andalucia"], ["south-granada-6", "south", "andalucia"]]);
    const result = resolveTurn(scenario, state, [{ factionId: faction("republic"), orders: [withdrawal("republic", "rep-vitoria-8", "andalucia", "murcia")] }], 1);
    expect(result.finalState.units[unit("rep-vitoria-8")]?.territoryId).toBe("murcia");
    expect(result.outcomes.some((outcome) => outcome.kind === "withdrew")).toBe(true);
    expect(result.outcomes.some((outcome) => outcome.kind === "rejected-order")).toBe(false);
  });
});

describe("the loader keeps initialControl and holders in step (L26)", () => {
  it("rejects a territory whose initialControl disagrees with its holders", async () => {
    const { loadPackage, PackageValidationError } = await import("../main/scenarios/loader");
    const { modularMap, modularScenario } = await import("./modularFixture");
    const document = modularScenario();
    const territories = document["territories"] as Json[];
    const isle = territories.find((entry) => entry["id"] === "isle");
    if (isle !== undefined) isle["initialControl"] = { "@type": "controlled", "@data": { factionId: "blue" } };
    const assetPaths = new Set(["assets/maps/tiny-front.svg", "assets/maps/tiny-front-relief.webp", "assets/icons/nato/infantry.svg"]);
    try {
      loadPackage({ assetPaths, mapDocument: modularMap(), mapPath: "map.json", scenarioDocument: document, scenarioPath: "scenario.json" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PackageValidationError);
      expect((error as InstanceType<typeof PackageValidationError>).issues.join("\n")).toContain("(L26)");
    }
  });
});

describe("the computer player in contested ground (H5)", () => {
  it("withdraws from hopeless contested ground through its own sub-territories", async () => {
    const { planWithdrawals } = await import("../main/ai/orders/withdraw");
    const { seededRandom } = await import("../main/engine/random");
    const scenario = spain();
    // Three regiments against one, 12 to 6 less popular resistance, leave the Republic better
    // than even odds of holding Andalucia (D24); the Army of Africa makes it hopeless.
    const units = [
      ["rep-vitoria-8", "republic", "andalucia"],
      ["south-granada-6", "south", "andalucia"], ["south-lepanto-5", "south", "andalucia"], ["south-cadiz-33", "south", "andalucia"]
    ] as const;
    const holdable = withUnits(scenario, units);
    expect(planWithdrawals({ factionId: faction("republic"), memory: {}, planned: [], random: seededRandom(1), scenario, state: holdable })).toEqual([]);
    const state = withUnits(scenario, [...units, ["south-africa-vanguard", "south", "andalucia"], ["south-legion", "south", "andalucia"], ["south-regulares", "south", "andalucia"]]);
    const orders = planWithdrawals({ factionId: faction("republic"), memory: {}, planned: [], random: seededRandom(1), scenario, state });
    // R1: its pocket is Málaga alone, so the only way out is the sea lane to Murcia.
    expect(orders).toEqual([withdrawal("republic", "rep-vitoria-8", "andalucia", "murcia")]);
    // The South, stronger there, stays and attacks; the North in the Oviedo pocket has no way out.
    expect(planWithdrawals({ factionId: faction("south"), memory: {}, planned: [], random: seededRandom(1), scenario, state })).toEqual([]);
    const pocket = withUnits(scenario, [["north-milan-32", "north", "asturias"], ["rep-asturian-militia", "republic", "asturias"], ["rep-santander-column", "republic", "asturias"]]);
    expect(planWithdrawals({ factionId: faction("north"), memory: {}, planned: [], random: seededRandom(1), scenario, state: pocket })).toEqual([]);
  });

  it("sends its demoralized units out when healthy ones hold", async () => {
    const { planWithdrawals } = await import("../main/ai/orders/withdraw");
    const { seededRandom } = await import("../main/engine/random");
    const scenario = spain();
    const base = withUnits(scenario, [["rep-vitoria-8", "republic", "andalucia"], ["rep-sevilla-34", "republic", "andalucia"], ["south-granada-6", "south", "andalucia"]]);
    const shaken = base.units[unit("rep-sevilla-34")];
    if (shaken === undefined) throw new Error("missing unit");
    const state = { ...base, units: { ...base.units, [shaken.id]: { ...shaken, morale: { demoralized: true, quietTurns: 0 } } } };
    const orders = planWithdrawals({ factionId: faction("republic"), memory: {}, planned: [], random: seededRandom(1), scenario, state });
    expect(orders.map((entry) => entry.unitId)).toEqual(["rep-sevilla-34"]);
  });

  it("never gives an impossible or rejected order over whole computer games", async () => {
    const { generateComputerSubmission } = await import("../main/ai/computerPlayer");
    const { deriveSeed } = await import("../main/engine/random");
    const { seededRandom } = await import("../main/engine/random");
    const d20Ground: unknown[] = [];
    // Kept short (M-6, as D22 did for the others): two games of eight turns, one per dice module, so it
    // finishes well inside the limit under the full suite's load.
    for (const [scenario, seed] of [[spain(), 1], [spainWithAir(), 2]] as const) {
      let state = initialGameState(scenario);
      for (let turn = 1; turn <= 8; turn += 1) {
        const submissions = scenario.factions.map((entry, index) =>
          generateComputerSubmission(scenario, state, entry.id, seededRandom(deriveSeed(seed, turn, index))));
        const result = resolveTurn(scenario, state, submissions, seed);
        const bad = result.outcomes.filter((outcome) => outcome.kind === "invalid-order" || (outcome.kind === "rejected-order" && outcome.order.kind === "withdraw"));
        expect(bad).toEqual([]);
        // P4 under the shipped d20: battles flip sub-territories, each change naming a battle of the turn.
        const battles = result.outcomes.filter((outcome) => outcome.kind === "battle").length;
        for (const change of result.subTerritoryChanges.filter((entry) => entry.cause === "battle")) {
          expect(change.battleIndex).toBeLessThan(battles);
          d20Ground.push(change);
        }
        if (result.victory !== undefined) break;
        state = { ...result.finalState, turnNumber: result.finalState.turnNumber + 1 };
      }
    }
    expect(d20Ground.length).toBeGreaterThan(0);
  });
});
