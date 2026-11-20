import { isNeighbor, requireTerritory } from "../../engine/lookup";
import { type StandingOrder, standingOrder } from "../../engine/orders";
import type { MoveOrder, Scenario, TerritoryId, UnitId, WithdrawOrder } from "../../engine/types";
import { validateMoveOrder } from "../../engine/validation";
import type { OrderKind, PlannedOrder } from "../session";
import { selectedWithdrawRoutes } from "./contested";
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
  switch (orderKind) {
    case "move":
      return chooseMove(scenario, session);
    case "replenish":
      return chooseReplenish(scenario, session);
    case "withdraw":
      return chooseWithdraw(scenario, session);
    case "attack":
    case "hold":
      return chooseDefault(session, orderKind);
    case "entrench":
    case "rest":
      return chooseStanding(session, orderKind, scenario);
  }
}

/** C1: Attack (Hold for demoralized armies) is the default in contested ground; choosing it drops planned withdrawals. */
function chooseDefault(session: PlanningSession, kind: "attack" | "hold"): PlanningSession {
  const chosen = new Set(session.draft.selectedUnitIds);
  const orders = session.draft.orders.filter((order) => !chosen.has(order.unitId));
  const territoryId = session.draft.selectedTerritoryId;
  const draft = territoryId === undefined ? { orders, selectedUnitIds: [] } : selecting(territoryId, availableUnitIds(session, territoryId, orders), orders);
  const who = chosen.size === 1 ? "1 army" : `${String(chosen.size)} armies`;
  return withDraft(session, { ...draft, feedback: `${who} will ${kind === "attack" ? "attack where they stand" : "hold"}.` });
}

/** C1, P6: Withdraw. With one way out it is planned at once; with several, the player picks a highlighted territory. */
function chooseWithdraw(scenario: Scenario, session: PlanningSession): PlanningSession {
  const routes = selectedWithdrawRoutes(scenario, session);
  const [only] = routes;
  if (only === undefined) return feedback(session, "These armies have no way out through your own sub-territories.");
  const choosing = withDraft(session, { ...selectionOf(session.draft), stage: { orderKind: "withdraw", step: "choose-destination" } });
  return routes.length === 1 ? chooseDestination(scenario, choosing, only.to) : choosing;
}

function chooseStanding(session: PlanningSession, kind: StandingOrder, scenario?: Scenario): PlanningSession {
  const fitting = new Set(selectedUnits(session).filter((unit) => standingOrder(unit) === kind).map((unit) => unit.id));
  if (fitting.size === 0) {
    return feedback(session, kind === "entrench" ? "Demoralized armies cannot entrench. They rest instead." : "Only demoralized armies rest.");
  }
  const orders = session.draft.orders.filter((order) => !fitting.has(order.unitId));
  const territoryId = session.draft.selectedTerritoryId;
  const kept = replenishWithout(session.draft, fitting);
  const draft = {
    ...(territoryId === undefined ? { orders, selectedUnitIds: [] } : selecting(territoryId, availableUnitIds(session, territoryId, orders, kept.replenishments, scenario), orders)),
    ...kept
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
  const withdrawing = session.draft.stage.orderKind === "withdraw";
  if (!selectedDestinations(scenario, session).includes(territoryId)) {
    return feedback(session, withdrawing ? "Withdraw to a highlighted territory: one you hold whole, reached through your own sub-territories." : refusal(scenario, session, origin, territoryId));
  }
  const planned: PlannedOrder[] = session.draft.selectedUnitIds.map((unitId): MoveOrder | WithdrawOrder => ({
    factionId: session.factionId,
    from: origin,
    kind: withdrawing ? "withdraw" : "move",
    to: territoryId,
    unitId
  }));
  const replanned = new Set(session.draft.selectedUnitIds);
  const orders = [...session.draft.orders.filter((order) => !replanned.has(order.unitId)), ...planned];
  return withDraft(session, { ...selecting(origin, availableUnitIds(session, origin, orders, undefined, scenario), orders), ...replenishWithout(session.draft, replanned) });
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
