import type { FactionId, TerritoryId, UnitId } from "../../ids";
import type { MoveOrder, Order } from "../orders";

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
  readonly order: MoveOrder;
}

/** M9: an impossible move; its army is disbanded. */
export interface InvalidOrderOutcome {
  readonly kind: "invalid-order";
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
