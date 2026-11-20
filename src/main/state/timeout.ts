import { createAction } from "@reduxjs/toolkit";
import type { Scenario } from "../engine/types";
import type { PlanningSession } from "./planning";
import type { Session } from "./session";
import { submitDraft } from "./submit";

/** T5: the planning player's clock reached zero. Dispatched once by the timer chip. */
export const timeRanOut = createAction("game/timeRanOut");

/**
 * T5 (Q-TIMER-3): when time runs out the orders already planned go in as they are, exactly as
 * End Turn would submit them (moves, withdrawals, Recruit, Replenish, Build, air missions and
 * Sack), a half-built order (an order stage still open) is dropped, and every other unit takes
 * its default. The submission says the time ran out, so the turn report can say so (T6).
 */
export function submitOnTimeout(scenario: Scenario, planning: PlanningSession): Session {
  return submitDraft(scenario, planning, true);
}
