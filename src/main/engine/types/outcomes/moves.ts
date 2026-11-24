import type { FactionId, SubTerritoryId, TerritoryId, UnitId } from "../../ids";
import type { MoveLeg, MoveOrder, Order } from "../orders";

/** Move outcomes (M1-M11, M19-M21) and order outcomes, owned by the movement and reveal phases. */

export type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

/** Why a move failed to enter its destination. */
export type BounceCause =
  | { readonly kind: "standoff"; readonly opposingFactionIds: readonly FactionId[] }
  | { readonly kind: "held"; readonly holdingFactionIds: readonly FactionId[] }
  | { readonly kind: "head-on"; readonly opposingFactionIds: readonly FactionId[] };

export interface SuccessfulMoveOutcome {
  readonly kind: "successful-move";
  readonly order: MoveOrder;
}

export interface BouncedMoveOutcome {
  readonly cause: BounceCause;
  readonly kind: "bounced-move";
  readonly order: MoveOrder;
  /** M21: another faction took the origin, so the army fell back here instead of returning. */
  readonly retreatedTo?: TerritoryId;
}

/** Interim M8, and M21 surrender: the army bounced and another faction holds its origin. */
export interface DisbandedMoveOutcome {
  readonly capturedByFactionId: FactionId;
  readonly cause: BounceCause;
  readonly kind: "disbanded-move";
  /** The army's men when it surrendered. */
  readonly men: number;
  readonly order: MoveOrder;
}

/** M9: an impossible move; its army is disbanded. */
export interface InvalidOrderOutcome {
  readonly kind: "invalid-order";
  /** The men of the disbanded army. */
  readonly men: number;
  readonly order: MoveOrder;
  readonly reason: string;
}

/**
 * Section 2 step 1: an order other than a move that failed validation at reveal. Nothing is
 * disbanded, and anything it paid for is refunded.
 */
export interface RejectedOrderOutcome {
  readonly kind: "rejected-order";
  readonly order: Exclude<Order, MoveOrder>;
  readonly reason: string;
}

export interface NoMoveOutcome {
  readonly factionId: FactionId;
  readonly kind: "no-move";
  readonly unitId?: UnitId;
}

/** C10: a move into territory its faction holds or controls; it always arrives. */
export interface ReinforcementArrivedOutcome {
  readonly kind: "reinforcement-arrived";
  readonly order: MoveOrder;
}

/** D5: a boarding capital whose trains have too few places left for an army. */
export interface RailShortage {
  readonly boarding: SubTerritoryId;
  /** Places left, fewer than the army needs. */
  readonly left: number;
  /** Places the army needs. */
  readonly places: number;
}

/** M1, M3, M5, D27.1: why an army's move could not go this turn. */
export type HeldBackCause =
  | { readonly reason: "allowance" | "port-landings" | "amphibious-lane" | "cannot-fight" }
  | { readonly rail: RailShortage; readonly reason: "rail-full" };

/**
 * M1, M3, M5: an army's move did not go. Its route was longer than its allowance, or the
 * boarding capital, the landing port or the sea lane had no room left this turn, or it has no
 * unit that can fight and was not joining its own side (D27.1). The army
 * stays where it is and takes its standing order; nothing is disbanded.
 */
export type MoveHeldBackOutcome = HeldBackCause & {
  readonly factionId: FactionId;
  readonly from: TerritoryId;
  readonly kind: "move-held-back";
  readonly to: TerritoryId;
  readonly unitIds: readonly UnitId[];
};

/** M2 (Q-UX-I3): an enemy army entered a territory the army was passing through; it stopped there and defends it. */
export interface MoveInterceptedOutcome {
  readonly byFactionIds: readonly FactionId[];
  readonly factionId: FactionId;
  readonly from: TerritoryId;
  readonly kind: "move-intercepted";
  readonly stoppedAt: TerritoryId;
  readonly to: TerritoryId;
  readonly unitIds: readonly UnitId[];
}

/** M3-M5: an army travelled by rail, by sea or on a march; `legs` is the whole route it was given. */
export interface MoveTransitOutcome {
  readonly factionId: FactionId;
  readonly from: TerritoryId;
  readonly kind: "move-transit";
  readonly legs: readonly MoveLeg[];
  readonly to: TerritoryId;
  readonly unitIds: readonly UnitId[];
}

/** Every Milestone 3 outcome of the movement area. Adding a kind here is all the union needs. */
export type MovementTurnOutcome = MoveHeldBackOutcome | MoveInterceptedOutcome | MoveTransitOutcome;
