import { applyBuildOrder, validateBuildOrder, withBuildOrders } from "../../engine/economy/catalogue";
import { subtractResources, treasuryOf } from "../../engine/resources";
import type { BuildOrder, GameState, Scenario } from "../../engine/types";
import { refusedFeedback } from "../../presentation/feedback";
import type { Draft } from "../session";
import { basketCost } from "./recruitment";
import { feedback, type PlanningSession, withDraft } from "./selection";

/**
 * $5: Build orders planned this turn, in `Draft.builds` (carried through selection changes by
 * `keepBasket`). They are paid at reveal, before Recruit and Replenish orders; the pane previews
 * them as queued and paid, against what the Recruit basket leaves.
 */

export function plannedBuilds(session: Pick<PlanningSession, "draft">): readonly BuildOrder[] {
  return session.draft.builds ?? [];
}

/**
 * The state as if this turn's planned Build orders were already queued and paid, with the
 * Recruit and Replenish basket's cost also taken from the treasury, so a build is never planned
 * with money the basket needs.
 */
export function previewState(scenario: Scenario, session: PlanningSession): GameState {
  const { state } = session.game;
  const balance = treasuryOf(state, session.factionId);
  const afterBasket: GameState = state.treasuries[session.factionId] === undefined
    ? state
    : { ...state, treasuries: { ...state.treasuries, [session.factionId]: subtractResources(balance, basketCost(scenario, session)) } };
  return withBuildOrders(scenario, afterBasket, plannedBuilds(session));
}

/**
 * Plans a Build order. It must be valid on its own against the start of the turn (the engine's
 * gateway) and fit after everything already planned.
 */
export function planBuild(scenario: Scenario, session: PlanningSession, order: BuildOrder): PlanningSession {
  const own = { ...order, factionId: session.factionId };
  const alone = validateBuildOrder(scenario, session.game.state, own);
  if (!alone.ok) return feedback(session, refusedFeedback(alone.refusal));
  const after = applyBuildOrder(scenario, previewState(scenario, session), own);
  if (!after.ok) return feedback(session, refusedFeedback(after.refusal));
  const draft: Draft = { ...session.draft, builds: [...plannedBuilds(session), own], feedback: { code: "build-queued" } };
  return withDraft(session, draft);
}

/** Removes a planned Build order, and any planned after it that no longer fit. */
export function cancelBuild(scenario: Scenario, session: PlanningSession, index: number): PlanningSession {
  const remaining = plannedBuilds(session).filter((_, at) => at !== index);
  const base = previewState(scenario, { ...session, draft: { ...session.draft, builds: [] } });
  let state = base;
  const kept: BuildOrder[] = [];
  for (const order of remaining) {
    const applied = applyBuildOrder(scenario, state, order);
    if (applied.ok) {
      state = applied.state;
      kept.push(order);
    }
  }
  const draft: Draft = { ...session.draft, builds: kept };
  delete (draft as { feedback?: unknown }).feedback;
  return withDraft(session, draft);
}
