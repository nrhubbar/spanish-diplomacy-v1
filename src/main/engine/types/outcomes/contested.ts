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
  /** P3, P7: the one-a-turn sweep inside a contested territory. */
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
