import { upkeepShortfall } from "../../engine/economy/upkeep";
import { disbandProblem, validateDisbandOrder } from "../../engine/recruitment/disband";
import type { DisbandOrder, Resources, Scenario, UnitId, UnitState } from "../../engine/types";
import { unitsNamed } from "../../presentation/recruitment";
import type { Draft } from "../session";
import { stayWithout } from "./orders";
import { draftOrders, unitOrdersWithout } from "./recruitment";
import { type PlanningSession, feedback, selectedUnits, withDraft } from "./selection";

/** D1: whether a unit can disband: ground units and aircraft, not generals, wherever they stand. */
export function canDisband(scenario: Scenario, session: PlanningSession, unit: UnitState): boolean {
  return disbandProblem(scenario, session.game.state, unit) === undefined;
}

/** N1: the selected units Disband is offered for: those that can and are not going already. A general in the selection stays (selecting a territory selects him too). */
export function disbandableSelection(scenario: Scenario, session: PlanningSession): readonly UnitId[] {
  return selectedUnits(session).filter((unit) => canDisband(scenario, session, unit) && !isDisbandPlanned(session.draft, unit.id)).map((unit) => unit.id);
}

/** D1: whether a unit has a Disband order in the draft. */
export function isDisbandPlanned(draft: Draft, unitId: UnitId): boolean {
  return draft.disbands?.some((order) => order.unitId === unitId) ?? false;
}

/**
 * D1, N1: plans Disband for units, in place of their moves, Replenish, stay orders or air
 * missions: one change to the draft, or none when one of them cannot disband. The units leave
 * the selection, so the next order does not replace it, and an open destination choice closes.
 * Each is cleared like any unit's order (`removeOrder`).
 */
export function planDisband(scenario: Scenario, session: PlanningSession, unitIds: readonly UnitId[]): PlanningSession {
  const planned = unitIds.map((unitId): DisbandOrder => ({ factionId: session.factionId, kind: "disband", unitId }));
  for (const order of planned) {
    const validation = validateDisbandOrder(scenario, session.game.state, order);
    if (!validation.ok) return feedback(session, validation.reason);
  }
  const { draft } = session;
  const others = unitOrdersWithout(draft, unitIds);
  const next: Draft = {
    ...draft,
    ...others,
    ...stayWithout(draft, unitIds),
    ...(draft.airOrders === undefined ? {} : { airOrders: draft.airOrders.filter((each) => !unitIds.includes(each.unitId)) }),
    disbands: [...others.disbands ?? [], ...planned],
    feedback: `${unitsNamed(scenario, unitIds)} will disband at the end of the turn.`,
    orders: draft.orders.filter((each) => !unitIds.includes(each.unitId)),
    selectedUnitIds: draft.selectedUnitIds.filter((id) => !unitIds.includes(id))
  };
  delete (next as { stage?: unknown }).stage;
  return withDraft(session, next);
}

/** D1: what next turn's stock falls short of with the draft's orders, in points; empty when it covers the upkeep. */
export function plannedShortfall(scenario: Scenario, session: PlanningSession): Resources {
  return upkeepShortfall(scenario, session.game.state, session.factionId, draftOrders(session.draft));
}
