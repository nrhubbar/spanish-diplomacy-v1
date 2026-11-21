import type { BuildingId, DevelopmentId, FactionId, SubTerritoryId, TerritoryId, UnitId } from "../../ids";
import type { AirMissionOrder } from "../orders";
import type { RaidOutcome } from "../systems";

/** Air mission outcomes (U2-U4, D7), owned by `m3r1-air-generals` (phases 2, 5, 11). */

/** U3: a raid's roll and what it did. */
export interface RaidFlownOutcome {
  /** U3: "air eliminated" and fighter losses: the aircraft lost. */
  readonly aircraftLost: readonly UnitId[];
  /** "Building downgraded or destroyed": the building hit. */
  readonly buildingId?: BuildingId;
  /** AG-11: with no building there, the development track that lost a level. */
  readonly developmentId?: DevelopmentId;
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

/** U2, U3, D27.3: fighters intercepted enemy aircraft (raids, support, and recon they shot down) over a territory. */
export interface InterceptionOutcome {
  readonly factionId: FactionId;
  readonly interceptorIds: readonly UnitId[];
  readonly kind: "interception";
  readonly lostUnitIds: readonly UnitId[];
  /** The enemy aircraft intercepted, whatever their mission. */
  readonly raiderIds: readonly UnitId[];
  /**
   * CT-46: set when the intercepted flights were recon, to the fliers' factions. Recon
   * interceptions are kept apart from raids and support, and only the fighters' faction and the
   * fliers see them, since they name the territory a recon flew over.
   */
  readonly reconFactionIds?: readonly FactionId[];
  readonly territoryId: TerritoryId;
}

/** R11: an aircraft flew Ground Support; the battle names the bonus as an `air-support` modifier. */
export interface SupportFlownOutcome {
  /** R11: with `battleIndex`, whether its side's Ground Support applied (false: the enemy won the air, or a tie). */
  readonly applied?: boolean;
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

/** AG-9: an aircraft whose base was lost flew to the nearest airbase of its faction in range. */
export interface AircraftRebasedOutcome {
  readonly factionId: FactionId;
  readonly from: TerritoryId;
  readonly kind: "aircraft-rebased";
  readonly to: TerritoryId;
  readonly unitId: UnitId;
}

/** AG-9: an aircraft whose base was lost had no airbase in range, and was lost on the ground. */
export interface AircraftLostOutcome {
  readonly factionId: FactionId;
  readonly from: TerritoryId;
  readonly kind: "aircraft-lost";
  readonly unitId: UnitId;
}

/** R11: one aircraft over a battle, with its numbers from its type's effects. */
export interface AirBattleAircraft {
  /** What it adds to its side's air battle roll (the `air-battle` effect: 2 a fighter, 1 a bomber in Spain). */
  readonly airRoll: number;
  readonly factionId: FactionId;
  readonly mission: "patrol" | "support";
  /** What it adds for its side when its side's Ground Support applies (`battle-support`); 0 on Patrol. */
  readonly supportRoll: number;
  readonly unitId: UnitId;
}

/** R11: one side of an air battle: the aircraft over the battle on Ground Support or Patrol. */
export interface AirBattleSide {
  readonly aircraft: readonly AirBattleAircraft[];
  /** Anti-air the side adds as a plus (the best `raid-defence` there, negated); only the defender has it. */
  readonly antiAir: number;
  readonly factionId: FactionId;
}

/** R11: what an air battle is fought with. */
export interface AirBattleInput {
  readonly attacker: AirBattleSide;
  readonly defender: AirBattleSide;
  /** The most aircraft whose Ground Support counts for one side (the scenario's `air.supportMax`); absent means no cap. */
  readonly supportMax?: number;
}

/** R11: each side's d20, from the `air-battle` roll stream. */
export interface AirBattleRolls {
  readonly attacker: number;
  readonly defender: number;
}

/** R11: the air battle's totals (d20 + each aircraft's air roll, plus the defender's AA) and who won the air. */
export interface AirBattleResult {
  readonly attackerTotal: number;
  readonly defenderTotal: number;
  readonly rolls: AirBattleRolls;
  /** The side whose Ground Support applies; `tie` means neither side's does. Nobody loses aircraft. */
  readonly winner: "attacker" | "defender" | "tie";
}

/** R11: the Ground Support that counted for each side: the aircraft and the roll they add (0 when none). */
export interface GroundSupportApplied {
  readonly attacker: { readonly roll: number; readonly unitIds: readonly UnitId[] };
  readonly defender: { readonly roll: number; readonly unitIds: readonly UnitId[] };
}

/** R11: an air battle was fought over a battle before it (`air/groundSupport.ts`). */
export interface AirBattleOutcome {
  /** Index of the battle the air battle was fought over. */
  readonly battleIndex: number;
  readonly input: AirBattleInput;
  readonly kind: "air-battle";
  readonly result: AirBattleResult;
  /** What the winner's Ground Support added; both 0 on a tie. */
  readonly support: GroundSupportApplied;
  readonly territoryId: TerritoryId;
}

/** Every outcome of this area. Adding a kind here is all the union needs. */
export type AirTurnOutcome =
  | AirBattleOutcome
  | RaidFlownOutcome
  | ReconFlownOutcome
  | InterceptionOutcome
  | SupportFlownOutcome
  | GroundedOutcome
  | AircraftRebasedOutcome
  | AircraftLostOutcome;
