import type { ActorKind, FactionId, ScenarioId } from "../engine/types";
import type { GameCommand, GameId, GameRefusal, PlayerView } from "./types";

/**
 * The one door between the screens and whoever runs the game. A command is sent and forgotten;
 * what came of it arrives as an event: the player's new view, or why the command was refused. A
 * host may answer within the call or a second later, so nothing here waits.
 */

export interface CreateGame {
  readonly assignments: Readonly<Record<FactionId, ActorKind>>;
  readonly kind: "create";
  readonly scenarioId: ScenarioId;
  /** The player's own seed; without one the host draws a secret one. */
  readonly seed?: string;
  readonly timerMinutes: number;
}

export type ClientCommand = CreateGame | { readonly command: GameCommand; readonly gameId: GameId; readonly kind: "game" } | { readonly gameId: GameId; readonly kind: "leave" };

export type GameEvent =
  /** `turnNumber` is the turn the refused command was for, so an answer that comes late is not taken for a newer turn's. */
  | { readonly kind: "refused"; readonly refusal: GameRefusal; readonly turnNumber?: number }
  | { readonly kind: "view"; readonly view: PlayerView };

export interface GameClient {
  readonly send: (command: ClientCommand) => void;
  readonly subscribe: (listener: (event: GameEvent) => void) => () => void;
}

/** The longest seed a player may give a game. */
export const maxSeedLength = 64;

/** A player's seed as the game keeps it, or undefined when they gave none. */
export function givenSeed(text: string | undefined): string | undefined {
  const trimmed = text?.trim().slice(0, maxSeedLength) ?? "";
  return trimmed === "" ? undefined : trimmed;
}
