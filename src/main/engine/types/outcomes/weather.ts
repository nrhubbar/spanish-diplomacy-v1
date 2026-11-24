import type { FactionId, TerritoryId, UnitId } from "../../ids";
import type { WeatherState } from "../state";

/** Weather outcomes (T2, T4), owned by `m3r1-weather-timer` (phase 0) and the movement phase (frostbite). */

/** T2: the turn's single d20 roll and each zone's outcome. */
export interface WeatherRolledOutcome {
  readonly kind: "weather-rolled";
  readonly turnNumber: number;
  readonly weather: WeatherState;
}

/** T4, D7: a unit that moved in Severe cold lost men to frostbite. */
export interface FrostbiteOutcome {
  /** D6: the unit was left below the d20's `breakUpShare` of its full strength and broke up. */
  readonly destroyed?: true;
  readonly factionId: FactionId;
  readonly kind: "frostbite";
  /** Men lost: all the unit had left when it broke up. */
  readonly men: number;
  readonly territoryId: TerritoryId;
  readonly unitId: UnitId;
}

/** T5, T6: a player's planning time ran out; their planned orders went in and the rest took defaults. */
export interface TimeRanOutOutcome {
  readonly factionId: FactionId;
  /** Units that took their default order. */
  readonly heldUnitCount: number;
  readonly kind: "time-ran-out";
}

/** Every outcome of this area. Adding a kind here is all the union needs. */
export type WeatherTurnOutcome =
  | WeatherRolledOutcome
  | FrostbiteOutcome
  | TimeRanOutOutcome;
