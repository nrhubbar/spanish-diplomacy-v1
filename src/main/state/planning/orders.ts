import { isNeighbor, requireTerritory } from "../../engine/lookup";
import { type StandingOrder, standingOrder } from "../../engine/orders";
import type { MoveOrder, Scenario, TerritoryId, UnitId } from "../../engine/types";
import { validateMoveOrder } from "../../engine/validation";
import type { OrderKind } from "../session";
import { chooseReplenish, replenishWithout } from "./recruitment";
import { type PlanningSession, availableUnitIds, feedback, selectedDestinations, selectedUnits, selecting, selectionOf, withDraft } from "./selection";

/** "Give Selected Armies Order": opens the order choice, or closes it when it is open. */
export function toggleOrderChoice(session: PlanningSession): PlanningSession {
  if (session.draft.selectedUnitIds.length === 0) {
    return feedback(session, "Select at least one army first.");
  }
  const base = selectionOf(session.draft);
  return withDraft(session, session.draft.stage?.step === "choose-order" ? base : { ...base, stage: { step: "choose-order" } });
}

/**
 * Picks the order type for the selected armies. Move starts choosing its destination. Entrench
 * and Rest cancel the moves of the selected armies they fit (O2, O5), and the territory returns
 * to the selection rule.
 */
export function chooseOrder(scenario: Scenario, session: PlanningSession, orderKind: OrderKind): PlanningSession {
  if (session.draft.selectedUnitIds.length === 0) {
    return feedback(session, "Select at least one army first.");
  }
  if (orderKind === "replenish") return chooseReplenish(scenario, session);
  return orderKind === "move" ? chooseMove(scenario, session) : chooseStanding(session, orderKind);
}

function chooseStanding(session: PlanningSession, kind: StandingOrder): PlanningSession {
  const fitting = new Set(selectedUnits(session).filter((unit) => standingOrder(unit) === kind).map((unit) => unit.id));
  if (fitting.size === 0) {
    return feedback(session, kind === "entrench" ? "Demoralized armies cannot entrench. They rest instead." : "Only demoralized armies rest.");
  }
  const orders = session.draft.orders.filter((order) => !fitting.has(order.unitId));
  const territoryId = session.draft.selectedTerritoryId;
  const draft = {
    ...(territoryId === undefined ? { orders, selectedUnitIds: [] } : selecting(territoryId, availableUnitIds(session, territoryId, orders), orders)),
    ...replenishWithout(session.draft, fitting)
  };
  const who = fitting.size === 1 ? "1 army" : `${String(fitting.size)} armies`;
  return withDraft(session, { ...draft, feedback: `${who} will ${kind === "entrench" ? "entrench" : "rest"}.` });
}

function chooseMove(scenario: Scenario, session: PlanningSession): PlanningSession {
  const choosing = withDraft(session, { ...selectionOf(session.draft), stage: { orderKind: "move", step: "choose-destination" } });
  return selectedDestinations(scenario, choosing).length === 0
    ? feedback(session, "These armies cannot move anywhere together this turn.")
    : choosing;
}

/** Leaves the order or destination choice and keeps the armies selected. */
export function cancelOrder(session: PlanningSession): PlanningSession {
  return withDraft(session, selectionOf(session.draft));
}

/**
 * Choosing a legal destination plans the move immediately; there is no separate confirm step.
 * It replaces any move a selected army already had. The origin stays selected with its armies
 * that have no move order, following the selection rule.
 */
export function chooseDestination(scenario: Scenario, session: PlanningSession, territoryId: TerritoryId): PlanningSession {
  const origin = session.draft.selectedTerritoryId;
  if (session.draft.stage?.step !== "choose-destination" || origin === undefined) {
    return feedback(session, "Select armies and choose Move first.");
  }
  if (territoryId === origin) {
    return feedback(session, "Choose a different territory as the destination.");
  }
  if (!selectedDestinations(scenario, session).includes(territoryId)) {
    return feedback(session, refusal(scenario, session, origin, territoryId));
  }
  const planned: MoveOrder[] = session.draft.selectedUnitIds.map((unitId) => ({
    factionId: session.factionId,
    from: origin,
    kind: "move",
    to: territoryId,
    unitId
  }));
  const replanned = new Set(session.draft.selectedUnitIds);
  const orders = [...session.draft.orders.filter((order) => !replanned.has(order.unitId)), ...planned];
  return withDraft(session, { ...selecting(origin, availableUnitIds(session, origin, orders), orders), ...replenishWithout(session.draft, replanned) });
}

/** Clears an army's move or Replenish order, which returns it to its standing order (O5). */
export function removeOrder(session: PlanningSession, unitId: UnitId): PlanningSession {
  return withDraft(session, {
    ...session.draft,
    orders: session.draft.orders.filter((order) => order.unitId !== unitId),
    ...replenishWithout(session.draft, [unitId])
  });
}

/** Why the selected armies cannot move to `to`: no connection, or the engine's own reason. */
function refusal(scenario: Scenario, session: PlanningSession, from: TerritoryId, to: TerritoryId): string {
  if (!isNeighbor(scenario, from, to)) {
    return `${requireTerritory(scenario, to).name} is not connected to ${requireTerritory(scenario, from).name}. Choose a highlighted territory.`;
  }
  const reasons = session.draft.selectedUnitIds.flatMap((unitId) => {
    const validation = validateMoveOrder(scenario, session.game.state, { factionId: session.factionId, from, kind: "move", to, unitId });
    return validation.ok ? [] : [validation.reason];
  });
  return reasons[0] ?? "These armies cannot move there together. Choose a highlighted territory.";
}
