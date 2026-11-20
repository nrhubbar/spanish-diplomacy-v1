import type { Order, PlayerSubmission, Scenario } from "../engine/types";
import { advance, lockSubmission } from "./coordinator";
import { airDraftOrders, draftOrders, type PlanningSession } from "./planning";
import type { Draft, Session } from "./session";

/**
 * Every order a draft submits: moves and withdrawals, Replenish, Recruit and Build orders, then
 * air missions and Sack orders. End Turn and the timer (T5) both submit exactly these, so time
 * running out never drops a basket.
 */
export function submittedDraftOrders(draft: Draft): readonly Order[] {
  return [...draftOrders(draft), ...airDraftOrders(draft)];
}

/** Locks the planning player's draft and moves on: to the next player, or to the turn's resolution. */
export function submitDraft(scenario: Scenario, planning: PlanningSession, timedOut = false): Session {
  const submission: PlayerSubmission = {
    factionId: planning.factionId,
    orders: submittedDraftOrders(planning.draft),
    ...(timedOut ? { timedOut: true as const } : {})
  };
  return advance(scenario, lockSubmission(scenario, planning.game, submission), planning.factionId);
}
