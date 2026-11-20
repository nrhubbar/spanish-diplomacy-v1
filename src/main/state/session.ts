import type { StandingOrder } from "../engine/orders";
import type {
  ActorKind,
  BuildOrder,
  FactionId,
  GameState,
  MoveOrder,
  PlayerSubmission,
  ScenarioId,
  SubTerritoryId,
  TerritoryId,
  TurnOutcome,
  TurnResolutionResult,
  UnitId
} from "../engine/types";

export type Assignments = Readonly<Record<FactionId, ActorKind>>;

export interface TurnHistoryEntry {
  readonly outcomes: readonly TurnOutcome[];
  readonly turnNumber: number;
}

/** Everything that persists across phases of one game. */
export interface GameRecord {
  readonly assignments: Assignments;
  readonly history: readonly TurnHistoryEntry[];
  /** Locked submissions for the current turn. Never exposed by planning selectors (M2 7.4). */
  readonly locked: Readonly<Record<FactionId, PlayerSubmission>>;
  readonly scenarioId: ScenarioId;
  readonly seed: number;
  readonly state: GameState;
}

/**
 * Every order an army can have (O1): a move, or the standing order it follows without one,
 * Entrench when healthy and Rest when demoralized. Only moves are submitted (O5).
 */
export type OrderKind = MoveOrder["kind"] | StandingOrder;

/**
 * Where the player is in giving an order to the selected armies: choosing the order type,
 * then its target. Absent while the player is still choosing armies.
 */
export type OrderStage =
  | { readonly step: "choose-order" }
  | { readonly orderKind: MoveOrder["kind"]; readonly step: "choose-destination" };

/** The current local player's private working set. */
export interface Draft {
  readonly feedback?: string;
  /** X3: the sub-territory the pane is focused on, inside the selected territory. */
  readonly focusedSubTerritoryId?: SubTerritoryId;
  readonly orders: readonly MoveOrder[];
  readonly selectedTerritoryId?: TerritoryId;
  readonly selectedUnitIds: readonly UnitId[];
  readonly stage?: OrderStage;
}

export type Session =
  | { readonly phase: "idle" }
  | {
      readonly assignments: Assignments;
      readonly feedback?: string;
      readonly phase: "setup";
      readonly scenarioId: ScenarioId;
    }
  | {
      readonly factionId: FactionId;
      readonly fromFactionId?: FactionId;
      readonly game: GameRecord;
      readonly phase: "handoff";
    }
  | {
      /** $5: Build orders planned this turn (`planning/builds.ts`), kept apart from the draft that selection rebuilds. */
      readonly builds?: readonly BuildOrder[];
      readonly draft: Draft;
      readonly factionId: FactionId;
      readonly game: GameRecord;
      readonly phase: "planning";
    }
  | { readonly game: GameRecord; readonly phase: "resolution"; readonly result: TurnResolutionResult }
  | { readonly game: GameRecord; readonly phase: "game-over"; readonly result: TurnResolutionResult };

export type Phase = Session["phase"];
export type InGameSession = Exclude<Session, { readonly phase: "idle" | "setup" }>;

export const emptyDraft: Draft = { orders: [], selectedUnitIds: [] };

export function isInGame(session: Session): session is InGameSession {
  return session.phase !== "idle" && session.phase !== "setup";
}

export function localPlayerCount(assignments: Assignments): number {
  return Object.values(assignments).filter((kind) => kind === "local-human").length;
}
