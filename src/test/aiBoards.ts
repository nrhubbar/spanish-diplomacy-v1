import { generateComputerSubmission } from "../main/ai/computerPlayer";
import { seededRandom } from "../main/engine/random";
import { type GameState, isMoveOrder, type MoveOrder, type Order, type Scenario, type TerritoryControl } from "../main/engine/types";
import { armyIn, faction, unit, withUnits } from "./support";

/** Boards and helpers for computer-player tests. */

export type Placement = readonly (readonly [string, string, string])[];

export const ordersOf = (scenario: Scenario, state: GameState, factionId: string, seed = 1): readonly MoveOrder[] =>
  generateComputerSubmission(scenario, state, faction(factionId), seededRandom(seed)).orders.filter(isMoveOrder);

export const into = (orders: readonly Order[], to: string): readonly string[] =>
  orders.filter(isMoveOrder).filter((order) => order.to === to).map((order) => order.unitId).sort();

/**
 * Places armies on a board where the faction controls every territory except `others`, which
 * keep their opening control unless listed as `republican`, so no empty territory tempts it
 * away from the case under test.
 */
export function board(scenario: Scenario, factionId: string, others: readonly string[], units: Placement, republican: readonly string[] = []): GameState {
  const state = withUnits(scenario, units);
  const control = { ...state.control };
  for (const entry of scenario.territories) {
    if (!others.includes(entry.id)) control[entry.id] = { factionId: faction(factionId), kind: "controlled" };
    if (republican.includes(entry.id)) control[entry.id] = { factionId: faction("republic"), kind: "controlled" };
  }
  return { ...state, control };
}

export function demoralize(state: GameState, ids: readonly string[]): GameState {
  const units = { ...state.units };
  for (const id of ids) units[unit(id)] = { ...armyIn(state, id), morale: { demoralized: true, quietTurns: 0 } };
  return { ...state, units };
}

/** The Republic one territory short of victory (9 of 10), each territory held whole by one side. */
export const oneShortOwners: Readonly<Record<string, string>> = {
  andalucia: "south", aragon: "north", cantabria: "republic", catalunya: "republic", ceuta: "south",
  "castilla-la-mancha": "republic", "castilla-y-leon": "north", extremadura: "republic", galicia: "north",
  "islas-baleares": "south", "la-rioja": "north", madrid: "republic", melilla: "south", murcia: "republic",
  navarra: "north", "pais-vasco": "republic", asturias: "republic", valencia: "republic"
};

/** A board where every territory, sub-territories included, is held whole by the faction named for it. */
export function heldWhole(scenario: Scenario, owners: Readonly<Record<string, string>>, units: Placement): GameState {
  const state = withUnits(scenario, units);
  const control: Record<string, TerritoryControl> = {};
  for (const [id, holder] of Object.entries(owners)) control[id] = { factionId: faction(holder), kind: "controlled" };
  const subTerritories = Object.fromEntries(scenario.subTerritories.map((sub) => [sub.id, { ...state.subTerritories[sub.id], holder: faction(owners[sub.territoryId] ?? "north") }]));
  return { ...state, control, subTerritories: subTerritories as GameState["subTerritories"] };
}
