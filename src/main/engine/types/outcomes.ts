import type { CityId, FactionId, TerritoryId } from "../ids";
import type { Order } from "./orders";
import type { TerritoryControl, VictoryCondition } from "./scenario";
import type { GameState } from "./state";
import type { AirTurnOutcome } from "./outcomes/air";
import type { BattleOutcome } from "./outcomes/battle";
import type { ContestedTurnOutcome, SubTerritoryChange } from "./outcomes/contested";
import type { EconomyTurnOutcome } from "./outcomes/economy";
import type { GeneralsTurnOutcome } from "./outcomes/generals";
import type { MoraleTurnOutcome, RecoveredOutcome } from "./outcomes/morale";
import type {
  BouncedMoveOutcome,
  DisbandedMoveOutcome,
  InvalidOrderOutcome,
  NoMoveOutcome,
  ReinforcementArrivedOutcome,
  RejectedOrderOutcome,
  SuccessfulMoveOutcome
} from "./outcomes/moves";
import type { RecruitmentTurnOutcome } from "./outcomes/recruitment";
import type { WeatherTurnOutcome } from "./outcomes/weather";

/**
 * Every turn outcome, joined in one place. Each slice owns its area's file under `outcomes/`,
 * and adding a kind to that file's union is the only edit it needs.
 */

export * from "./outcomes/air";
export * from "./outcomes/battle";
export * from "./outcomes/contested";
export * from "./outcomes/economy";
export * from "./outcomes/generals";
export * from "./outcomes/morale";
export * from "./outcomes/moves";
export * from "./outcomes/recruitment";
export * from "./outcomes/weather";

/** Outcomes of the Milestone 2 rules, the only ones `m2-strength` produces. */
export type MilestoneTwoOutcome =
  | SuccessfulMoveOutcome
  | BouncedMoveOutcome
  | DisbandedMoveOutcome
  | InvalidOrderOutcome
  | RejectedOrderOutcome
  | NoMoveOutcome
  | ReinforcementArrivedOutcome
  | RecoveredOutcome
  | BattleOutcome;

/** Outcomes of the Milestone 3 systems: one union per area file. */
export type SystemOutcome =
  | WeatherTurnOutcome
  | RecruitmentTurnOutcome
  | EconomyTurnOutcome
  | ContestedTurnOutcome
  | AirTurnOutcome
  | GeneralsTurnOutcome
  | MoraleTurnOutcome;

export type TurnOutcome = MilestoneTwoOutcome | SystemOutcome;

export interface ControlChange {
  readonly after: TerritoryControl;
  readonly before: TerritoryControl;
  readonly territoryId: TerritoryId;
}

export interface CityChange {
  readonly after: FactionId;
  readonly before: FactionId | undefined;
  readonly cityId: CityId;
}

export interface VictoryProgress {
  readonly citiesControlled: number;
  readonly cityThreshold: number;
  readonly factionId: FactionId;
  readonly territoriesControlled: number;
  readonly territoryThreshold: number;
}

export interface VictoryResult {
  readonly condition: VictoryCondition | "shared";
  readonly factionIds: readonly FactionId[];
}

export interface TurnResolutionResult {
  readonly cityChanges: readonly CityChange[];
  readonly controlChanges: readonly ControlChange[];
  readonly finalState: GameState;
  readonly outcomes: readonly TurnOutcome[];
  readonly progress: readonly VictoryProgress[];
  /** P2-P4: sub-territories that changed hands, including the contested sweep. Empty without sub-territories. */
  readonly subTerritoryChanges: readonly SubTerritoryChange[];
  readonly submittedOrders: readonly Order[];
  readonly victory?: VictoryResult;
}
