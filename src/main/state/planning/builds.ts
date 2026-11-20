import { applyBuildOrder, validateBuildOrder, withBuildOrders } from "../../engine/economy/catalogue";
import type { BuildOrder, GameState, Scenario } from "../../engine/types";
import { feedback, type PlanningSession } from "./selection";

/**
 * $5: Build orders planned this turn. They live on the planning session beside the draft, so
 * selecting territories and planning moves (which rebuild the draft) keeps them. They are paid
 * at reveal; until then the pane previews them as queued and paid.
 */

export function plannedBuilds(session: Pick<PlanningSession, "builds">): readonly BuildOrder[] {
  return session.builds ?? [];
}

/** The state as if this turn's planned Build orders were already queued and paid. */
export function previewState(scenario: Scenario, session: Pick<PlanningSession, "builds" | "game">): GameState {
  return withBuildOrders(scenario, session.game.state, plannedBuilds(session));
}

/**
 * Plans a Build order. It must be valid on its own against the start of the turn (the engine's
 * gateway) and fit after the orders already planned (the reveal's running ledger).
 */
export function planBuild(scenario: Scenario, session: PlanningSession, order: BuildOrder): PlanningSession {
  const own = { ...order, factionId: session.factionId };
  const alone = validateBuildOrder(scenario, session.game.state, own);
  if (!alone.ok) return feedback(session, alone.reason);
  const after = applyBuildOrder(scenario, previewState(scenario, session), own);
  if (!after.ok) return feedback(session, after.reason);
  return { ...session, builds: [...plannedBuilds(session), own], draft: { ...session.draft, feedback: "Queued. It is paid when orders are revealed." } };
}

/** Removes a planned Build order, and any planned after it that no longer fit. */
export function cancelBuild(scenario: Scenario, session: PlanningSession, index: number): PlanningSession {
  const remaining = plannedBuilds(session).filter((_, at) => at !== index);
  let state = session.game.state;
  const kept: BuildOrder[] = [];
  for (const order of remaining) {
    const applied = applyBuildOrder(scenario, state, order);
    if (applied.ok) {
      state = applied.state;
      kept.push(order);
    }
  }
  return { ...session, builds: kept };
}
