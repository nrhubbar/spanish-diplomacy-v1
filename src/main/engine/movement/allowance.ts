import { type AllowanceContext, hookedAllowanceDelta } from "../hooks";
import type { FactionId, GameState, Scenario, TerritoryId, UnitId } from "../types";
import { unitTypeOf } from "./network";

/**
 * M1: the movement allowance, in territories. An army moves 1, plus 1 when its trucks carry
 * every unit that needs carrying, minus 1 in Mud or Snow (the weather module's hook), never
 * below 1. Entering a mountain or swamp sub-territory costs one more on a March (P8, priced in
 * `routes.ts`). Rail legs are free.
 */

/** The base allowance before any hook (M1). */
export const baseAllowance = 1;

/** What the army's units need and carry (M1, Q-MR-20): one truck per `carries` other units; mobile units need none. */
export interface Transport {
  /** Every unit is mobile (cavalry): the army ignores the terrain cost. */
  readonly allMobile: boolean;
  /** Units the army's transport can carry. */
  readonly capacity: number;
  /** Units that need carrying: neither transport nor mobile. */
  readonly needing: number;
  /** Units of a transport type. */
  readonly transports: number;
}

export function transportOf(scenario: Scenario, state: GameState, unitIds: readonly UnitId[]): Transport {
  let capacity = 0;
  let needing = 0;
  let transports = 0;
  let mobile = 0;
  let counted = 0;
  for (const unitId of unitIds) {
    const type = unitTypeOf(scenario, state, unitId);
    // AG-3: generals ride with their army and aircraft never march, so neither needs or adds transport.
    if (type !== undefined && type.kind !== "ground") continue;
    counted += 1;
    const effects = type?.effects ?? [];
    const carry = effects.find((effect) => effect.kind === "transport");
    if (carry?.kind === "transport") {
      capacity += carry.carries;
      transports += 1;
    } else if (effects.some((effect) => effect.kind === "mobile")) {
      mobile += 1;
    } else {
      needing += 1;
    }
  }
  return { allMobile: counted > 0 && mobile === counted, capacity, needing, transports };
}

/** M1: +1 when the army's transport carries every unit that needs it (an all-cavalry army needs none). */
export function truckBonus(scenario: Scenario, state: GameState, unitIds: readonly UnitId[]): number {
  const transport = transportOf(scenario, state, unitIds);
  if (transport.needing + transport.transports === 0 && !transport.allMobile) return 0;
  return transport.capacity >= transport.needing && (transport.transports > 0 || transport.needing === 0) ? 1 : 0;
}

/** The movement module's `allowanceDelta` hook: the truck bonus. */
export const truckAllowanceDelta = (context: AllowanceContext): number => truckBonus(context.scenario, context.state, context.unitIds);

/** M1: the army's allowance before terrain: 1 plus every hook's change (trucks, weather), never below 1. */
export function armyAllowance(scenario: Scenario, state: GameState, factionId: FactionId, from: TerritoryId, unitIds: readonly UnitId[]): number {
  return Math.max(1, baseAllowance + hookedAllowanceDelta({ factionId, from, scenario, state, unitIds }));
}

/** M1: a path of steps fits the allowance when its cost does, and a single step always fits. */
export function fitsAllowance(cost: number, steps: number, allowance: number): boolean {
  return steps <= 1 || cost <= allowance;
}
