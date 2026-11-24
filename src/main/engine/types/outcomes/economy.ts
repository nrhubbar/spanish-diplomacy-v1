import type { FactionId, SubTerritoryId, UnitId } from "../../ids";
import type { Resources } from "../economy";
import type { BuildOrder } from "../orders";
import type { BuildProject } from "../state";

/** Build queue and income outcomes ($1-$8, U3 cuts), owned by `m3r1-economy-builds` (phases 1, 10, 11). */

/** $5: a Build order was paid and queued. */
export interface BuildQueuedOutcome {
  readonly kind: "build-queued";
  readonly order: BuildOrder;
  readonly paid: Resources;
  /** Place in the queue, 0 for the item in progress. */
  readonly position: number;
}

/** $5: the item heading a queue progressed by a turn. */
export interface BuildProgressedOutcome {
  readonly factionId: FactionId;
  readonly kind: "build-progressed";
  readonly progress: number;
  readonly project: BuildProject;
  readonly subTerritoryId: SubTerritoryId;
  readonly turns: number;
}

/** $5: an item finished: the building stands, or the level rose. */
export interface BuildCompletedOutcome {
  readonly factionId: FactionId;
  readonly kind: "build-completed";
  readonly project: BuildProject;
  readonly subTerritoryId: SubTerritoryId;
}

/** $5: the sub-territory changed hands; the item in progress passes to the new holder and its payment is lost. */
export interface BuildForfeitedOutcome {
  readonly kind: "build-forfeited";
  readonly lost: Resources;
  readonly newHolder: FactionId;
  readonly previousHolder: FactionId;
  readonly project: BuildProject;
  readonly subTerritoryId: SubTerritoryId;
}

/** $5: an item not yet started was refunded to the faction that queued it, or a Build order failed at reveal. */
export interface BuildRefundedOutcome {
  readonly factionId: FactionId;
  readonly kind: "build-refunded";
  readonly project: BuildProject;
  readonly reason: string;
  readonly refund: Resources;
  readonly subTerritoryId: SubTerritoryId;
}

/** $2, U3: a faction's income for the turn, from territories it holds whole, after raid cuts. */
export interface IncomeOutcome {
  readonly cut: Resources;
  readonly factionId: FactionId;
  readonly kind: "income";
  readonly paid: Resources;
  /** The sub-territories whose yield a raid cut this turn. */
  readonly cutSubTerritoryIds: readonly SubTerritoryId[];
}

/** D1: men who left a unit because its upkeep could not be paid. */
export interface MenLeft {
  readonly men: number;
  readonly unitId: UnitId;
}

/** D1: a faction's upkeep for the turn, in points; what it could not pay, and the men who left over it. */
export interface UpkeepOutcome {
  readonly due: Resources;
  readonly factionId: FactionId;
  readonly kind: "upkeep";
  readonly left: readonly MenLeft[];
  readonly short: Resources;
}

/** Every outcome of this area. Adding a kind here is all the union needs. */
export type EconomyTurnOutcome =
  | BuildQueuedOutcome
  | BuildProgressedOutcome
  | BuildCompletedOutcome
  | BuildForfeitedOutcome
  | BuildRefundedOutcome
  | IncomeOutcome
  | UpkeepOutcome;
