import { describe, expect, it } from "vitest";
import { generateComputerSubmission } from "../../main/ai/computerPlayer";
import { planAirMissions } from "../../main/ai/orders/air-mission";
import { airRecruitChoices } from "../../main/ai/orders/airRecruits";
import { planGeneralMoves } from "../../main/ai/orders/general";
import type { PlanningContext } from "../../main/ai/orders/planner";
import { planSackings } from "../../main/ai/orders/sack";
import { generalUnitDefinition } from "../../main/engine/generals/identity";
import { seededRandom } from "../../main/engine/random";
import { initialGameState } from "../../main/engine/resolution";
import type { GameState, Order, UnitId } from "../../main/engine/types";
import { validateSubmission } from "../../main/engine/validation";
import { faction, move, spainWithAir, territory, unit } from "../support";

function context(state: GameState, factionId: string, planned: readonly Order[] = []): PlanningContext {
  return { factionId: faction(factionId), memory: {}, planned, random: seededRandom(1), scenario: spainWithAir(), state };
}

describe("the computer player's air missions (H5)", () => {
  const state = initialGameState(spainWithAir());

  it("flies every aircraft that can: bombers raid, fighters intercept, recon looks at the enemy", () => {
    const orders = planAirMissions(context(state, "republic"));
    const byUnit = new Map(orders.map((order) => [order.unitId as string, order.mission.kind]));
    expect(byUnit.get("rep-breguet-bombers")).toBe("raid");
    expect(byUnit.get("rep-ni52-fighters")).toBe("intercept");
    expect(byUnit.get("rep-catalan-recon")).toBe("recon");
  });

  it("sends bombers to support the biggest attack the move planner chose in range", () => {
    const attack = [move("republic", "rep-wad-ras-1", "madrid", "castilla-y-leon"), move("republic", "rep-covadonga-4", "madrid", "castilla-y-leon")];
    const orders = planAirMissions(context(state, "republic", attack));
    expect(orders.find((order) => order.unitId === "rep-breguet-bombers")?.mission).toEqual({ kind: "support", territoryId: "castilla-y-leon" });
  });

  it("gives orders the engine accepts, together with every other planner's", () => {
    for (const id of ["republic", "north", "south"]) {
      const submission = generateComputerSubmission(spainWithAir(), state, faction(id), seededRandom(2));
      expect(validateSubmission(spainWithAir(), state, faction(id), submission)).toEqual({ ok: true });
      expect(submission.orders.some((order) => order.kind === "air-mission")).toBe(true);
    }
  });
});

describe("the computer player's generals (H5)", () => {
  const scenario = spainWithAir();
  const state = initialGameState(scenario);

  it("sends a general with the biggest attack leaving his territory", () => {
    const attack = [move("north", "north-navarre-requetes", "navarra", "pais-vasco"), move("north", "north-america-23", "navarra", "pais-vasco")];
    expect(planGeneralMoves(context(state, "north", attack))).toEqual([move("north", "north-general-mola", "navarra", "pais-vasco")]);
    expect(planGeneralMoves(context(state, "north"))).toEqual([]);
  });

  it("walks a lone general toward his faction's armies through ground it holds", () => {
    const mola = state.units[unit("north-general-mola")];
    if (mola === undefined) throw new Error("no Mola");
    const alone: GameState = { ...state, units: { ...state.units, [mola.id]: { ...mola, territoryId: territory("la-rioja") } } };
    const moves = planGeneralMoves(context(alone, "north"));
    expect(moves).toHaveLength(1);
    expect(moves[0]?.from).toBe("la-rioja");
  });

  it("sacks a general whose trait hurts when a better one is next on the roster", () => {
    const pozas = generalUnitDefinition(scenario, "general-sebastian-pozas" as UnitId);
    if (pozas === undefined) throw new Error("no Pozas");
    const units = Object.fromEntries(Object.entries(state.units).filter(([id]) => id !== "rep-general-miaja"));
    const cautious: GameState = {
      ...state,
      raised: { [pozas.id]: pozas },
      units: { ...units, [pozas.id]: { factionId: faction("republic"), fatigue: 0, id: pozas.id, morale: { demoralized: false, quietTurns: 0 }, strength: 100, territoryId: territory("madrid") } }
    };
    expect(planSackings(context(cautious, "republic"))).toEqual([{ factionId: "republic", kind: "sack", unitId: "general-sebastian-pozas" }]);
    expect(planSackings(context(state, "republic"))).toEqual([]);
  });
});

describe("the computer player's aircraft and anti-air recruits (H5, U1)", () => {
  it("buys anti-air where enemy bombers reach, and an aircraft when it has too few", () => {
    const scenario = spainWithAir();
    const state = initialGameState(scenario);
    const open = scenario.unitTypes.filter((type) => type.air !== undefined || type.effects.some((effect) => effect.kind === "raid-defence"));
    // The North has one aircraft for twelve ground units, and Republican bombers reach Castilla y Leon.
    expect(airRecruitChoices(scenario, state, faction("north"), territory("castilla-y-leon"), open).map((type) => type.id)).toEqual(["anti-air-battery", "bomber-squadron"]);
    // The Republic has three aircraft for its fifteen ground units: enough.
    expect(airRecruitChoices(scenario, state, faction("republic"), territory("madrid"), open).map((type) => type.id)).toEqual(["anti-air-battery"]);
    expect(airRecruitChoices(scenario, state, faction("republic"), territory("catalunya"), []).length).toBe(0);
  });
});
