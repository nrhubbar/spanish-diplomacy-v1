import { createAction } from "@reduxjs/toolkit";
import type { Scenario } from "../engine/types";
import { advance, lockSubmission } from "./coordinator";
import type { PlanningSession } from "./planning";
import type { Session } from "./session";

/** T5: the planning player's clock reached zero. Dispatched once by the timer chip. */
export const timeRanOut = createAction("game/timeRanOut");

/**
 * T5 (Q-TIMER-3): when time runs out the orders already planned go in as they are, a half-built
 * order (an order stage still open) is dropped, and every other unit takes its default. The
 * submission says the time ran out, so the turn report can say so (T6).
 */
export function submitOnTimeout(scenario: Scenario, planning: PlanningSession): Session {
  const submission = { factionId: planning.factionId, orders: planning.draft.orders, timedOut: true as const };
  return advance(scenario, lockSubmission(scenario, planning.game, submission), planning.factionId);
}
