import type { FactionId, SubTerritoryId, TerritoryId, UnitId } from "../../ids";
import type { WithdrawOrder } from "../orders";

/** Contested ground and sub-territory outcomes (P1-P8, C1, $8), owned by `m3r1-sub-territories` (phases 6-8). */

/** C1, P6: a Withdraw order carried its unit out of a contested territory. */
export interface WithdrewOutcome {
  readonly kind: "withdrew";
  readonly order: WithdrawOrder;
}

/** P6: a forced retreat or a Withdraw had no path through the mover's own sub-territories, so the unit surrendered. */
export interface PathSurrenderOutcome {
  readonly factionId: FactionId;
  readonly from: TerritoryId;
  readonly kind: "path-surrender";
  readonly unitId: UnitId;
}

/** $8: rail in an attacker-held sub-territory dropped when its territory became contested. */
export interface RailDamagedOutcome {
  readonly after: number;
  readonly before: number;
  readonly kind: "rail-damaged";
  readonly subTerritoryId: SubTerritoryId;
}

/** Why a sub-territory changed hands. */
export type SubTerritoryChangeCause =
  /** P3: an army entered a territory the enemy held whole, with no enemy army there. */
  | "occupation"
  /** P4: a graded battle result's ground. */
  | "battle"
  /** R2 (replacing the one-a-turn sweep): the end-of-turn flip of a territory only one side has ground armies in. */
  | "sweep";

/** P2-P4: one sub-territory that changed hands this turn, reported in `TurnResolutionResult`. */
export interface SubTerritoryChange {
  readonly after: FactionId;
  readonly before: FactionId;
  /** The battle, by index in the turn's battles, when `cause` is `battle`. */
  readonly battleIndex?: number;
  readonly cause: SubTerritoryChangeCause;
  readonly subTerritoryId: SubTerritoryId;
}

/**
 * R1: a side's ground in a contested territory split, or a pocket lost ground, leaving these
 * armies in a pocket of these sub-territories. Produced at step 8 (`partition/steps.ts` `settlePockets`).
 */
export interface PocketCutOutcome {
  readonly factionId: FactionId;
  readonly kind: "pocket-cut";
  /** The pocket the armies are left in, in scenario order. */
  readonly subTerritoryIds: readonly SubTerritoryId[];
  readonly territoryId: TerritoryId;
  readonly unitIds: readonly UnitId[];
}

/**
 * R2: at the end of the turn only one side had ground armies in the territory, so it flipped
 * whole to that side. Produced at step 8 (`partition/steps.ts` `flipWhole`).
 */
export interface TerritoryFlippedOutcome {
  /** The side that now holds the whole territory. */
  readonly factionId: FactionId;
  readonly kind: "territory-flipped";
  /** The sub-territories that changed hands, in scenario order. */
  readonly subTerritoryIds: readonly SubTerritoryId[];
  readonly territoryId: TerritoryId;
}

/** Every outcome of this area. Adding a kind here is all the union needs. */
export type ContestedTurnOutcome =
  | WithdrewOutcome
  | PathSurrenderOutcome
  | RailDamagedOutcome
  | PocketCutOutcome
  | TerritoryFlippedOutcome;
