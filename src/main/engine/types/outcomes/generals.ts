import type { FactionId, GeneralId, TerritoryId, UnitId } from "../../ids";
import type { MoveOrder, SackOrder } from "../orders";

/** Generals' outcomes (U5, D7), owned by `m3r1-air-generals` (phases 1 and 9). */

/** U5: a general died on the seeded roll after his army was destroyed or routed. */
export interface GeneralDiedOutcome {
  readonly factionId: FactionId;
  readonly generalId: GeneralId;
  readonly kind: "general-died";
  readonly territoryId: TerritoryId;
  readonly unitId: UnitId;
}

/** U5: a Sack order removed a general. */
export interface GeneralSackedOutcome {
  readonly generalId: GeneralId;
  readonly kind: "general-sacked";
  readonly order: SackOrder;
}

/** D7: the next general on the roster is due in the faction's seat territory. */
export interface ReplacementDueOutcome {
  readonly arrivesOnTurn: number;
  readonly factionId: FactionId;
  readonly generalId: GeneralId;
  readonly kind: "replacement-due";
}

/** D7: the replacement general arrived as a unit in the seat territory. */
export interface ReplacementArrivedOutcome {
  readonly factionId: FactionId;
  readonly generalId: GeneralId;
  readonly kind: "replacement-arrived";
  readonly territoryId: TerritoryId;
  readonly unitId: UnitId;
}

/** U5 (AG-4): a general's move. He goes where his army arrives; otherwise he stays where he was. */
export interface GeneralMovedOutcome {
  readonly arrived: boolean;
  readonly kind: "general-moved";
  readonly order: MoveOrder;
}

/** Every outcome of this area. Adding a kind here is all the union needs. */
export type GeneralsTurnOutcome =
  | GeneralDiedOutcome
  | GeneralSackedOutcome
  | ReplacementDueOutcome
  | ReplacementArrivedOutcome
  | GeneralMovedOutcome;
