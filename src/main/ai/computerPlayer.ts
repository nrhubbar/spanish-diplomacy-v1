import type { RandomSource } from "../engine/random";
import type { FactionId, GameState, Order, PlayerSubmission, Scenario, UnitId } from "../engine/types";
import { viewFor } from "../engine/visibility";
import { unitKindIn } from "../engine/air/pieces";
import { planAirMissions } from "./orders/air-mission";
import { planBuilds } from "./orders/build";
import { planGeneralMoves } from "./orders/general";
import { planMoves } from "./orders/move";
import type { ComputerPlayerContext, OrderPlanner, PlanningContext } from "./orders/planner";
import { planDisbands } from "./orders/disband";
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
/**
 * AG-3, M1: the move planner moves ground units only, and its own generals follow them
 * (`orders/general.ts`). It plans on the board without aircraft (D17) and without its own
 * generals, but with enemy generals, so its estimates count their +1 and trait, and a territory
 * held by a general alone is defended ground, as the battles treat it.
 */
const planGroundMoves: OrderPlanner<Order> = (context) => planMoves({ ...context, state: movePlanningView(context.scenario, context.state, context.factionId) });

export function movePlanningView(scenario: Scenario, state: GameState, factionId: FactionId): GameState {
  const units = Object.fromEntries(Object.entries(state.units).filter(([id, unit]) => {
    const kind = unitKindIn(scenario, state.raised, id as UnitId);
    return kind === "ground" || (kind === "general" && unit.factionId !== factionId);
  }));
  return Object.keys(units).length === Object.keys(state.units).length ? state : { ...state, units };
}

const planners: readonly OrderPlanner<Order>[] = [
  planGroundMoves,
  planWithdrawals,
  planDisbands,
  planReplenishment,
  planRecruits,
  planBuilds,
  planAirMissions,
  planSackings,
  planGeneralMoves
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
