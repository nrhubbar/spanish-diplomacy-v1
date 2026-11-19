import type { BuildingId, FactionId, SubTerritoryId, TerritoryId, UnitId } from "../../ids";
import type { AirMissionOrder } from "../orders";
import type { RaidOutcome } from "../systems";

/** Air mission outcomes (U2-U4, D7), owned by `m3r1-air-generals` (phases 2, 5, 11). */

/** U3: a raid's roll and what it did. */
export interface RaidFlownOutcome {
  /** U3: "air eliminated" and fighter losses: the aircraft lost. */
  readonly aircraftLost: readonly UnitId[];
  /** "Building downgraded or destroyed": the building hit. */
  readonly buildingId?: BuildingId;
  readonly kind: "raid";
  readonly order: AirMissionOrder;
  readonly result: RaidOutcome;
  /** The raid's d20 after anti-air and interception. */
  readonly roll: number;
  readonly subTerritoryId: SubTerritoryId;
}

/** U4: recon showed a territory's balances, queues and training until `untilTurn`. */
export interface ReconFlownOutcome {
  readonly kind: "recon";
  readonly order: AirMissionOrder;
  readonly territoryId: TerritoryId;
  readonly untilTurn: number;
}

/** U2, U3: fighters intercepted a raid over a territory. */
export interface InterceptionOutcome {
  readonly factionId: FactionId;
  readonly interceptorIds: readonly UnitId[];
  readonly kind: "interception";
  readonly lostUnitIds: readonly UnitId[];
  readonly raiderIds: readonly UnitId[];
  readonly territoryId: TerritoryId;
}

/** D7: bombers supported a battle; the battle names the bonus as an `air-support` modifier. */
export interface SupportFlownOutcome {
  /** Index of the battle supported, or absent when no battle was fought there. */
  readonly battleIndex?: number;
  readonly kind: "air-support";
  readonly order: AirMissionOrder;
  readonly territoryId: TerritoryId;
}

/** U2: an aircraft could not fly: grounded by weather, out of range, or without an airbase. */
export interface GroundedOutcome {
  readonly kind: "grounded";
  readonly order: AirMissionOrder;
  readonly reason: string;
}

/** Every outcome of this area. Adding a kind here is all the union needs. */
export type AirTurnOutcome =
  | RaidFlownOutcome
  | ReconFlownOutcome
  | InterceptionOutcome
  | SupportFlownOutcome
  | GroundedOutcome;
