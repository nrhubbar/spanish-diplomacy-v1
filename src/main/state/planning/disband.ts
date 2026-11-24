import { upkeepShortfall } from "../../engine/economy/upkeep";
import { disbandProblem, validateDisbandOrder } from "../../engine/recruitment/disband";
import type { DisbandOrder, Resources, Scenario, UnitId, UnitState } from "../../engine/types";
import { unitName } from "../../presentation/text";
import type { Draft } from "../session";
import { stayWithout } from "./orders";
import { draftOrders, unitOrdersWithout } from "./recruitment";
import { type PlanningSession, feedback, withDraft } from "./selection";

/** D1: whether a unit's card offers Disband: ground units and aircraft, not generals, wherever they stand. */
export function canDisband(scenario: Scenario, session: PlanningSession, unit: UnitState): boolean {
  return disbandProblem(scenario, session.game.state, unit) === undefined;
}

/** D1: whether a unit has a Disband order in the draft. */
export function isDisbandPlanned(draft: Draft, unitId: UnitId): boolean {
  return draft.disbands?.some((order) => order.unitId === unitId) ?? false;
}

/**
 * D1: plans one unit's Disband, in place of its move, Replenish, stay order or air mission. The
 * unit leaves the selection, so the next order does not replace it, and an open destination
 * choice closes. Cleared like any unit's order (`removeOrder`).
 */
export function planDisband(scenario: Scenario, session: PlanningSession, unitId: UnitId): PlanningSession {
  const order: DisbandOrder = { factionId: session.factionId, kind: "disband", unitId };
  const validation = validateDisbandOrder(scenario, session.game.state, order);
  if (!validation.ok) return feedback(session, validation.reason);
  const { draft } = session;
  const others = unitOrdersWithout(draft, [unitId]);
  const next: Draft = {
    ...draft,
    ...others,
    ...stayWithout(draft, [unitId]),
    ...(draft.airOrders === undefined ? {} : { airOrders: draft.airOrders.filter((each) => each.unitId !== unitId) }),
    disbands: [...others.disbands ?? [], order],
    feedback: `${unitName(scenario, unitId)} will disband at the end of the turn.`,
    orders: draft.orders.filter((each) => each.unitId !== unitId),
    selectedUnitIds: draft.selectedUnitIds.filter((id) => id !== unitId)
  };
  delete (next as { stage?: unknown }).stage;
  return withDraft(session, next);
}

/** D1: what next turn's stock falls short of with the draft's orders, in points; empty when it covers the upkeep. */
export function plannedShortfall(scenario: Scenario, session: PlanningSession): Resources {
  return upkeepShortfall(scenario, session.game.state, session.factionId, draftOrders(session.draft));
}
