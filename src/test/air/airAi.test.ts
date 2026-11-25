import { describe, expect, it } from "vitest";
import { generateComputerSubmission } from "../../main/ai/computerPlayer";
import { planAirMissions } from "../../main/ai/orders/air-mission";
import { planGeneralMoves } from "../../main/ai/orders/general";
import type { PlanningContext } from "../../main/ai/orders/planner";
import { planSackings } from "../../main/ai/orders/sack";
import { generalUnitDefinition } from "../../main/engine/generals/identity";
import { seededRandom } from "../../main/engine/random";
import { initialGameState } from "../../main/engine/resolution";
import { raisedDefinition, raisedUnitId } from "../../main/engine/recruitment/rules";
import type { GameState, Order, Scenario, UnitId, UnitTypeDefinition, UnitTypeId } from "../../main/engine/types";
import { validateSubmission } from "../../main/engine/validation";
import { faction, move, spainWithAir, territory, unit } from "../support";

function context(state: GameState, factionId: string, planned: readonly Order[] = [], scenario: Scenario = spainWithAir()): PlanningContext {
  return { factionId: faction(factionId), memory: {}, planned, random: seededRandom(1), scenario, state };
}

/** Spain with the bomber type flying only the missions given. */
function bombersFlying(missions: readonly ("raid" | "support")[]): Scenario {
  const scenario = spainWithAir();
  const retype = (type: UnitTypeDefinition): UnitTypeDefinition => (type.id === "bomber-squadron" && type.air !== undefined ? { ...type, air: { ...type.air, missions } } : type);
  return { ...scenario, index: { ...scenario.index, unitTypes: new Map([...scenario.index.unitTypes].map(([id, type]) => [id, retype(type)])) }, unitTypes: scenario.unitTypes.map(retype) };
}

describe("the computer player's air missions (H5)", () => {
  const state = initialGameState(spainWithAir());

  it("flies every aircraft that can: bombers raid, fighters intercept, recon looks at the enemy", () => {
    const orders = planAirMissions(context(state, "republic"));
    const byUnit = new Map(orders.map((order) => [order.unitId as string, order.mission.kind]));
    expect(byUnit.get("rep-breguet-bombers")).toBe("raid");
    expect(byUnit.get("rep-ni52-fighters")).toBe("patrol");
    expect(byUnit.get("rep-catalan-recon")).toBe("recon");
  });

  it("sends bombers to support the biggest attack the move planner chose in range", () => {
    const attack = [move("republic", "rep-wad-ras-1", "madrid", "castilla-y-leon"), move("republic", "rep-covadonga-4", "madrid", "castilla-y-leon")];
    const orders = planAirMissions(context(state, "republic", attack));
    expect(orders.find((order) => order.unitId === "rep-breguet-bombers")?.mission).toEqual({ kind: "support", territoryId: "castilla-y-leon" });
  });

  it("sends each raider to a target no other raider has, while there is one", () => {
    const pilots = Object.values(state.units).filter((entry) => entry.id === unit("rep-breguet-bombers"));
    const twin = raisedUnitId(faction("republic"), "bomber-squadron" as UnitTypeId, 1);
    const definition = raisedDefinition(spainWithAir(), twin)!;
    const [first] = pilots;
    const pair: GameState = { ...state, raised: { ...state.raised, [twin]: definition }, units: { ...state.units, [twin]: { ...first!, id: twin, strength: definition.fullStrength } } };
    const raids = planAirMissions(context(pair, "republic")).flatMap((order) => (order.mission.kind === "raid" ? [order.mission.subTerritoryId] : []));
    expect(raids).toHaveLength(2);
    expect(new Set(raids).size).toBe(2);
  });

  it("has a support-only type cover a threatened own territory when no attack needs it", () => {
    const supportOnly = bombersFlying(["support"]);
    const orders = planAirMissions(context(state, "republic", [], supportOnly));
    const mission = orders.find((order) => order.unitId === "rep-breguet-bombers")?.mission;
    expect(mission?.kind).toBe("support");
    const covered = mission?.kind === "support" ? mission.territoryId : territory("none");
    // Threatened: own units there, and enemy units next door.
    const units = Object.values(state.units);
    expect(units.some((entry) => entry.territoryId === covered && entry.factionId === faction("republic"))).toBe(true);
    const neighbours = new Set(supportOnly.index.neighbors.get(covered)?.map((neighbor) => neighbor.territoryId));
    expect(units.some((entry) => neighbours.has(entry.territoryId) && entry.factionId !== faction("republic"))).toBe(true);
    // An attack the move planner chose still comes first.
    const attack = [move("republic", "rep-wad-ras-1", "madrid", "castilla-y-leon")];
    expect(planAirMissions(context(state, "republic", attack, supportOnly)).find((order) => order.unitId === "rep-breguet-bombers")?.mission).toEqual({ kind: "support", territoryId: "castilla-y-leon" });
  });

  it("sends recon where it has not looked already, and keeps it home when everything in range is revealed", () => {
    const reconOf = (board: GameState) => planAirMissions(context(board, "republic")).find((order) => order.unitId === "rep-catalan-recon")?.mission;
    const first = reconOf(state);
    expect(first?.kind).toBe("recon");
    const looked = first?.kind === "recon" ? first.territoryId : territory("none");
    const seen = (territoryId: typeof looked, untilTurn: number) => ({ territoryId, untilTurn, viewerFactionId: faction("republic") });
    // A reveal still showing moves the flight on; an expired one, or another faction's, does not.
    const second = reconOf({ ...state, reveals: [seen(looked, state.turnNumber + 1)] });
    expect(second?.kind).toBe("recon");
    expect(second).not.toEqual(first);
    expect(reconOf({ ...state, reveals: [seen(looked, state.turnNumber)] })).toEqual(first);
    expect(reconOf({ ...state, reveals: [{ ...seen(looked, state.turnNumber + 1), viewerFactionId: faction("north") }] })).toEqual(first);
    const everything = spainWithAir().territories.map((entry) => seen(entry.id, state.turnNumber + 1));
    expect(reconOf({ ...state, reveals: everything })).toBeUndefined();
  });

  it("grounds an aircraft whose territory no longer has an airfield its faction holds", () => {
    const madrid = new Set((spainWithAir().index.subTerritoriesByTerritory.get(territory("madrid")) ?? []).map((entry) => entry.id as string));
    const noField: GameState = {
      ...state,
      subTerritories: Object.fromEntries(Object.entries(state.subTerritories).map(([id, site]) => [id, madrid.has(id) ? { ...site, buildings: [] } : site]))
    };
    const flying = planAirMissions(context(noField, "republic")).map((order) => order.unitId as string);
    expect(flying).not.toContain("rep-breguet-bombers");
    expect(flying).not.toContain("rep-ni52-fighters");
    expect(flying).toContain("rep-catalan-recon");
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

  it("sacks at most one general a turn: the worst, ties by unit id", () => {
    const field = (ids: readonly string[]): GameState => {
      const definitions = ids.map((id) => generalUnitDefinition(scenario, id as UnitId)!);
      const units = Object.fromEntries(Object.entries(state.units).filter(([id]) => id !== "rep-general-miaja"));
      return {
        ...state,
        raised: Object.fromEntries(definitions.map((definition) => [definition.id, definition])),
        units: { ...units, ...Object.fromEntries(definitions.map((definition) => [definition.id, { factionId: faction("republic"), fatigue: 0, id: definition.id, morale: { demoralized: false, quietTurns: 0 }, strength: 100, territoryId: territory("madrid") }])) }
      };
    };
    // Cautious (-1 attack) and Uninspiring (no rally) score the same; Vicente Rojo (Aggressive) is next.
    const sackings = planSackings(context(field(["general-sebastian-pozas", "general-jose-asensio"]), "republic"));
    expect(sackings).toEqual([{ factionId: "republic", kind: "sack", unitId: "general-jose-asensio" }]);
    expect(planSackings(context(field(["general-jose-asensio", "general-sebastian-pozas"]), "republic"))).toEqual(sackings);
  });
});
