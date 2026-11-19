import type { FactionId, TerritoryId, UnitId, UnitTypeId } from "../../ids";
import type { Resources } from "../economy";
import type { RecruitOrder, ReplenishOrder } from "../orders";

/** Recruit, training and Replenish outcomes (R1-R7, C8), owned by `m3r1-recruit-replenish` (phases 1, 9, 10). */

/** R2: a Recruit order was paid and its unit began training. */
export interface TrainingStartedOutcome {
  readonly kind: "training-started";
  readonly order: RecruitOrder;
  readonly paid: Resources;
  readonly turnsLeft: number;
  /** The id the unit will have when it appears. */
  readonly unitId: UnitId;
}

/** C8: training paused because its territory became contested. */
export interface TrainingPausedOutcome {
  readonly factionId: FactionId;
  readonly kind: "training-paused";
  readonly territoryId: TerritoryId;
  readonly unitId: UnitId;
}

/** R7: training finished and the unit appeared; it cannot move this turn. */
export interface TrainingCompletedOutcome {
  readonly factionId: FactionId;
  readonly kind: "training-completed";
  readonly territoryId: TerritoryId;
  readonly typeId: UnitTypeId;
  readonly unitId: UnitId;
}

/** R2, section 2 step 1: a Recruit order failed at reveal, or its training was lost, and was refunded. */
export interface TrainingRefundedOutcome {
  readonly factionId: FactionId;
  readonly kind: "training-refunded";
  readonly reason: string;
  readonly refund: Resources;
  readonly territoryId: TerritoryId;
  readonly typeId: UnitTypeId;
}

/** R5: men (and morale) restored by a Replenish order. */
export interface ReplenishAppliedOutcome {
  readonly kind: "replenish-applied";
  readonly men: number;
  readonly order: ReplenishOrder;
  readonly paid: Resources;
  /** R5, C5: the unit's demoralization was cleared. */
  readonly recovered: boolean;
}

/** R5, Q-MR-05: a battle cancelled the Replenish order; it was refunded. */
export interface ReplenishCancelledOutcome {
  readonly kind: "replenish-cancelled";
  readonly order: ReplenishOrder;
  readonly reason: string;
  readonly refund: Resources;
}
