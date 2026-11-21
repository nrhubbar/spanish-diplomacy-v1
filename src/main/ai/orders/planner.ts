import type { RandomSource } from "../../engine/random";
import type { FactionId, GameState, Order, Scenario, TurnOutcome } from "../../engine/types";

/**
 * Public information a computer player may use. It sees exactly what a human sees: the board
 * and the revealed outcomes of the previous turn, never another faction's pending orders.
 */
export interface ComputerPlayerContext {
  /** Every earlier turn's outcomes, oldest first. */
  readonly history?: readonly (readonly TurnOutcome[])[];
  readonly previousOutcomes?: readonly TurnOutcome[];
}

/** What every order planner (H5) is given: the faction's own view of the board, and its memory. */
export interface PlanningContext {
  readonly factionId: FactionId;
  readonly memory: ComputerPlayerContext;
  /** Orders the planners before this one chose this turn. */
  readonly planned: readonly Order[];
  /** The seeded tie-break source. Only the move planner draws from it, so new planners cannot shift today's games. */
  readonly random: RandomSource;
  readonly scenario: Scenario;
  /** The board as this faction sees it (`viewFor`): other factions' balances and queues are hidden. */
  readonly state: GameState;
}

/** H5: one planner per order kind, under `ai/orders/<kind>.ts`. */
export type OrderPlanner<Planned extends Order> = (context: PlanningContext) => readonly Planned[];
