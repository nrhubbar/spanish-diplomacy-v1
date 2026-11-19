import type { RandomSource } from "../engine/random";
import type { FactionId, GameState, Order, PlayerSubmission, Scenario } from "../engine/types";
import { viewFor } from "../engine/visibility";
import { planAirMissions } from "./orders/air-mission";
import { planBuilds } from "./orders/build";
import { planMoves } from "./orders/move";
import type { ComputerPlayerContext, OrderPlanner, PlanningContext } from "./orders/planner";
import { planRecruits } from "./orders/recruit";
import { planReplenishment } from "./orders/replenish";
import { planSackings } from "./orders/sack";
import { planWithdrawals } from "./orders/withdraw";

export type { ComputerPlayerContext } from "./orders/planner";
export { legalMoves } from "./orders/move";

/**
 * The planners in the order they run, one per order kind (H5). Each sees the orders the
 * earlier ones chose, so a later planner can avoid ordering a unit twice.
 */
const planners: readonly OrderPlanner<Order>[] = [
  planMoves,
  planWithdrawals,
  planReplenishment,
  planRecruits,
  planBuilds,
  planAirMissions,
  planSackings
];

/**
 * C18: a computer player's whole submission. It plans on its own view of the board (hidden
 * balances stay hidden) with the weights of its profile (`ai.profiles`, E7). The move planner
 * is `orders/move.ts`.
 */
export function generateComputerSubmission(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  random: RandomSource,
  memory: ComputerPlayerContext = {}
): PlayerSubmission {
  const view = viewFor(scenario, state, factionId);
  let planned: readonly Order[] = [];
  for (const planner of planners) {
    const context: PlanningContext = { factionId, memory, planned, random, scenario, state: view };
    planned = [...planned, ...planner(context)];
  }
  return { factionId, orders: planned };
}
