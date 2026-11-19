import { generateComputerSubmission } from "../main/ai/computerPlayer";
import { seededRandom } from "../main/engine/random";
import type { GameState, MoveOrder, Scenario } from "../main/engine/types";
import { armyIn, faction, unit, withUnits } from "./support";

/** Boards and helpers for computer-player tests. */

export type Placement = readonly (readonly [string, string, string])[];

export const ordersOf = (scenario: Scenario, state: GameState, factionId: string, seed = 1): readonly MoveOrder[] =>
  generateComputerSubmission(scenario, state, faction(factionId), seededRandom(seed)).orders;

export const into = (orders: readonly MoveOrder[], to: string): readonly string[] =>
  orders.filter((order) => order.to === to).map((order) => order.unitId).sort();

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
