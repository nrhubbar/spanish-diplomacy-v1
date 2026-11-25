import type { Brand } from "../engine/ids";
import type { ActorKind, FactionId, GameState, Order, Refusal, ScenarioId, TurnOutcome, TurnResolutionResult } from "../engine/types";

/**
 * The game service's data: plain JSON, with no browser, store or screen in it, so a server and
 * this device hold the same record. `GameRecord` is private to whoever runs the game. Players
 * only ever get a `PlayerView`.
 */

export type GameId = Brand<string, "GameId">;
/** Who is playing, as the host knows them: an account online, this device locally. */
export type PlayerId = Brand<string, "PlayerId">;

/** Who decides for a faction. One player may hold several seats (several people on one device). */
export type Seat = { readonly kind: "computer" } | { readonly kind: "human"; readonly playerId: PlayerId };

/** How a game's dice follow from its seed: `keyed` for play, `numeric` for the balance harness. */
export type RollScheme = "keyed-1" | "numeric-1";

/** A faction's orders for the turn being planned: replaced whole each time the player saves. */
export interface FactionOrders {
  /** The player ended the turn (or their time did): no more saves. */
  readonly ended: boolean;
  readonly orders: readonly Order[];
  /** The save's number, rising within a turn, so a late or repeated save is ignored. */
  readonly revision: number;
  readonly timedOut?: true;
}

/** One faction's planning clock for the turn. Times are milliseconds of the host's clock. */
export interface SeatClock {
  readonly budgetMs: number;
  /** Absent before it starts and while paused. */
  readonly runningSince?: number;
  readonly spentMs: number;
}

/** A resolved turn: its outcomes once, and which of them each faction (and a shared screen) saw. */
export interface TurnRecord {
  readonly outcomes: readonly TurnOutcome[];
  readonly seen: { readonly byFaction: Readonly<Partial<Record<FactionId, readonly number[]>>>; readonly shared: readonly number[] };
  readonly turnNumber: number;
}

/** The latest resolved turn in full, for its report. */
export interface TurnReport extends TurnResolutionResult {
  readonly turnNumber: number;
}

export const recordSchemaVersion = 1;

export interface GameRecord {
  readonly clocks: Readonly<Partial<Record<FactionId, SeatClock>>>;
  readonly gameId: GameId;
  /** Orders for the turn being planned, by faction. Empty once the game has ended. */
  readonly orders: Readonly<Partial<Record<FactionId, FactionOrders>>>;
  readonly report?: TurnReport;
  readonly rollScheme: RollScheme;
  readonly scenarioId: ScenarioId;
  /** The scenario data the game was made with, so a later release cannot change its rules unnoticed. */
  readonly scenarioVersion: string;
  readonly schemaVersion: typeof recordSchemaVersion;
  readonly seats: Readonly<Record<FactionId, Seat>>;
  /** Never sent to a player before the game ends. */
  readonly seed: string;
  /** Whether a player chose the seed, which everyone may know: its chooser can work out the dice. */
  readonly seedChosen: boolean;
  /** The board being planned on, or the final board. */
  readonly state: GameState;
  readonly status: "ended" | "planning";
  /** Minutes to plan a turn; 0 is no timer. */
  readonly timerMinutes: number;
  readonly turns: readonly TurnRecord[];
  /** Rises with every change, so a store can refuse a stale write and a client an old view. */
  readonly version: number;
}

/** One turn as the viewer saw it. */
export interface TurnSeen {
  readonly outcomes: readonly TurnOutcome[];
  readonly turnNumber: number;
}

/** What every screen of a game reads. */
export interface GameView {
  readonly assignments: Readonly<Record<FactionId, ActorKind>>;
  readonly gameId: GameId;
  readonly history: readonly TurnSeen[];
  /** Factions whose turn has ended. Readiness is public; orders are not. */
  readonly ready: readonly FactionId[];
  readonly scenarioId: ScenarioId;
  readonly state: GameState;
}

/** The whole of what a player is sent. Built field by field in `projection.ts`. */
export interface PlayerView extends GameView {
  readonly clock?: SeatClock;
  /** Only one player is in the game, so its clock may be paused. */
  readonly pausable: boolean;
  readonly report?: TurnReport;
  /** The viewer's own saved orders. */
  readonly saved?: FactionOrders;
  /** The factions this player plays, in scenario order. */
  readonly seats: readonly FactionId[];
  /** Only once the game has ended. */
  readonly seed?: string;
  readonly seedChosen: boolean;
  readonly status: GameRecord["status"];
  readonly timerMinutes: number;
  /** The record's version when the view was made. */
  readonly version: number;
  /** Whose view this is. Absent on a shared screen, which shows only what is public. */
  readonly viewer?: FactionId;
}

export interface NewGame {
  readonly gameId: GameId;
  readonly rollScheme: RollScheme;
  readonly scenarioVersion: string;
  readonly seats: GameRecord["seats"];
  readonly seed: string;
  readonly seedChosen: boolean;
  readonly timerMinutes: number;
}

/** What a player may ask of a game in play. */
export type GameCommand =
  /** Resolves a turn nobody plans: only in a game without human seats. */
  | { readonly kind: "advance"; readonly turnNumber: number }
  | { readonly factionId: FactionId; readonly kind: "end-turn"; readonly orders: readonly Order[]; readonly revision: number; readonly turnNumber: number }
  /** Asks the host to look at its own clock; ends the turns whose time is up. */
  | { readonly kind: "expire"; readonly turnNumber: number }
  /** The player has this seat's planning in front of them. */
  | { readonly factionId: FactionId; readonly kind: "open"; readonly turnNumber: number }
  | { readonly factionId: FactionId; readonly kind: "pause" | "resume"; readonly turnNumber: number }
  | { readonly factionId: FactionId; readonly kind: "save-orders"; readonly orders: readonly Order[]; readonly revision: number; readonly turnNumber: number };

/** Why a command was refused. Codes only; `presentation` words them. */
export type GameRefusal =
  | { readonly code: "cannot-pause" | "game-ended" | "malformed" | "not-your-seat" | "turn-ended" | "unknown-game" | "wrong-turn" }
  | { readonly code: "bad-orders"; readonly refusal: Refusal };

export type CommandResult = { readonly ok: true; readonly record: GameRecord } | { readonly ok: false; readonly refusal: GameRefusal };
