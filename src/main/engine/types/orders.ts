import type { FactionId, SubTerritoryId, TerritoryId, UnitId, UnitTypeId } from "../ids";
import type { BuildProject } from "./state";

/**
 * E8: one flat list of typed orders per faction, for units and sites alike. Entrench, Rest and
 * the contested Attack stay derived defaults, never submitted. An order kind that no
 * selected module handles is an impossible order (M9).
 */

/** M4: one leg of a move. Land and sea legs follow a connection; a rail leg rides to `to`'s capital. */
export interface MoveLeg {
  readonly kind: "land" | "rail" | "sea";
  readonly to: TerritoryId;
}

/** M1-M5: a unit's move from `from` to `to` along `legs`; `to` is the last leg's end. */
export interface MoveOrder {
  readonly factionId: FactionId;
  readonly from: TerritoryId;
  readonly kind: "move";
  /**
   * The path, in order. Absent means one step along the connection from `from` to `to`, the
   * only shape the `single-step` movement module allows.
   */
  readonly legs?: readonly MoveLeg[];
  readonly to: TerritoryId;
  readonly unitId: UnitId;
}

/** C1, P6: leave a contested territory for an adjacent one, through the mover's own sub-territories. */
export interface WithdrawOrder {
  readonly factionId: FactionId;
  readonly from: TerritoryId;
  readonly kind: "withdraw";
  readonly to: TerritoryId;
  readonly unitId: UnitId;
}

/** R5: restore a unit's men (and morale) in uncontested ground. */
export interface ReplenishOrder {
  readonly factionId: FactionId;
  readonly kind: "replenish";
  readonly unitId: UnitId;
}

/** D1: send one of the faction's own units home at the end of the turn, for nothing. */
export interface DisbandOrder {
  readonly factionId: FactionId;
  readonly kind: "disband";
  readonly unitId: UnitId;
}

/** R2: train one new unit at the territory's capital sub-territory. */
export interface RecruitOrder {
  readonly factionId: FactionId;
  readonly kind: "recruit";
  readonly territoryId: TerritoryId;
  readonly unitTypeId: UnitTypeId;
}

/** $5: queue one project in a sub-territory's build queue, paid when queued. */
export interface BuildOrder {
  readonly factionId: FactionId;
  readonly kind: "build";
  readonly project: BuildProject;
  readonly subTerritoryId: SubTerritoryId;
}

/**
 * U2-U4, R10: what an aircraft flies this turn. Patrol (fighters) replaced Intercept and still
 * intercepts raids. Ground Support (`support`) may be flown by fighters or bombers: a type's
 * `air.missions` says which it flies.
 */
export type AirMission =
  | { readonly kind: "raid"; readonly subTerritoryId: SubTerritoryId }
  | { readonly kind: "patrol"; readonly territoryId: TerritoryId }
  | { readonly kind: "support"; readonly territoryId: TerritoryId }
  | { readonly kind: "recon"; readonly territoryId: TerritoryId };

export interface AirMissionOrder {
  readonly factionId: FactionId;
  readonly kind: "air-mission";
  readonly mission: AirMission;
  readonly unitId: UnitId;
}

/** U5: a free order that replaces a general with the next one on the roster. */
export interface SackOrder {
  readonly factionId: FactionId;
  readonly kind: "sack";
  readonly unitId: UnitId;
}

export type Order = MoveOrder | WithdrawOrder | ReplenishOrder | DisbandOrder | RecruitOrder | BuildOrder | AirMissionOrder | SackOrder;

/** Orders given to one unit; a unit takes at most one of them per turn (M1). */
export type UnitOrder = MoveOrder | WithdrawOrder | ReplenishOrder | DisbandOrder | AirMissionOrder | SackOrder;

export interface PlayerSubmission {
  readonly factionId: FactionId;
  readonly orders: readonly Order[];
  /** T5, T6: the player's planning time ran out; the planned orders went in as they were. */
  readonly timedOut?: true;
}

export function isMoveOrder(order: Order): order is MoveOrder {
  return order.kind === "move";
}

export function isUnitOrder(order: Order): order is UnitOrder {
  return "unitId" in order;
}
