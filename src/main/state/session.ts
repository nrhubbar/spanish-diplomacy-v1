import type { GameView, TurnReport } from "../game/types";
import type {
  AirMissionKind,
  ActorKind,
  BuildOrder,
  DisbandOrder,
  FactionId,
  AirMissionOrder,
  MoveOrder,
  SackOrder,
  RecruitOrder,
  ReplenishOrder,
  ScenarioId,
  SubTerritoryId,
  TerritoryId,
  UnitId,
  WithdrawOrder
} from "../engine/types";
import type { Feedback } from "../presentation/feedback";

export type Assignments = Readonly<Record<FactionId, ActorKind>>;

/** What an army can be ordered to do. */
export type { OrderKind } from "../presentation/orderMenu";

/** The orders a player plans with a destination for armies: moves and withdrawals (C1). */
export type PlannedOrder = MoveOrder | WithdrawOrder;

/**
 * Where the player is in giving an order to the selected armies: choosing the target of a Move
 * or Withdraw (U4: the selection bar offers the order types directly). Absent otherwise.
 */
export type OrderStage =
  | { readonly orderKind: PlannedOrder["kind"]; readonly step: "choose-destination" }
  /** N6: the selected aircraft's mission, choosing its target on the map; `territoryId` is the territory whose sub-territory a raid is choosing. */
  | { readonly mission: AirMissionKind; readonly step: "choose-target"; readonly territoryId?: TerritoryId };

/** The current local player's private working set: what `submittedDraftOrders` saves, and what is selected. */
export interface Draft {
  /** U2, U5: air missions and Sack orders (m3r1-air-generals). Carried through selection changes by `withDraft`. */
  readonly airOrders?: readonly (AirMissionOrder | SackOrder)[];
  /** $5: Build orders planned this turn (m3r1-economy-builds, `planning/builds.ts`). Carried through selection changes by `keepBasket`. */
  readonly builds?: readonly BuildOrder[];
  /** D1: Disband orders, one per unit, never alongside another order of that unit. Carried through selection changes by `keepBasket`. */
  readonly disbands?: readonly DisbandOrder[];
  readonly feedback?: Feedback;
  /** X3: the sub-territory the pane is focused on, inside the selected territory. */
  readonly focusedSubTerritoryId?: SubTerritoryId;
  readonly orders: readonly PlannedOrder[];
  /** U2: the aircraft whose missions the pane shows (m3r1-air-generals). */
  readonly selectedAircraftId?: UnitId;
  /** X4, R2: the Recruit basket (m3r1-recruit-replenish). Carried through selection changes by `withDraft`. */
  readonly recruits?: readonly RecruitOrder[];
  /**
   * U2: armies the player told to stay this turn (Entrench, Rest, Attack or Hold), so End Turn
   * knows they have an order although nothing is submitted for them. Carried by `withDraft`.
   */
  readonly orderedToStay?: readonly UnitId[];
  /** R5: Replenish orders, one per unit, never alongside a move (m3r1-recruit-replenish). */
  readonly replenishments?: readonly ReplenishOrder[];
  readonly selectedTerritoryId?: TerritoryId;
  readonly selectedUnitIds: readonly UnitId[];
  readonly stage?: OrderStage;
}

export type Session =
  | { readonly phase: "idle" }
  | {
      readonly assignments: Assignments;
      readonly feedback?: Feedback;
      readonly phase: "setup";
      readonly scenarioId: ScenarioId;
    }
  | {
      readonly factionId: FactionId;
      readonly fromFactionId?: FactionId;
      readonly game: GameView;
      readonly phase: "handoff";
    }
  | { readonly draft: Draft; readonly factionId: FactionId; readonly game: GameView; readonly phase: "planning" }
  | { readonly game: GameView; readonly phase: "resolution"; readonly result: TurnReport }
  | { readonly game: GameView; readonly phase: "game-over"; readonly result: TurnReport };

export type Phase = Session["phase"];
export type InGameSession = Exclude<Session, { readonly phase: "idle" | "setup" }>;

export const emptyDraft: Draft = { orders: [], selectedUnitIds: [] };

export function isInGame(session: Session): session is InGameSession {
  return session.phase !== "idle" && session.phase !== "setup";
}

export function localPlayerCount(assignments: Assignments): number {
  return Object.values(assignments).filter((kind) => kind === "local-human").length;
}
