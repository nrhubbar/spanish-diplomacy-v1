import { isNeighbor, requireTerritory } from "../../engine/lookup";
import { type StandingOrder, standingOrder } from "../../engine/orders";
import { railShortageText } from "../../engine/movement/routes";
import { isMoveOrder, type MoveOrder, type Scenario, type TerritoryId, type UnitId, type WithdrawOrder } from "../../engine/types";
import { validateMoveOrder } from "../../engine/validation";
import { selectionFullTrains } from "../../presentation/movement";
import type { Draft, OrderKind, PlannedOrder } from "../session";
import { selectedWithdrawRoutes } from "./contested";
import { chooseReplenish, unitOrdersWithout } from "./recruitment";
import { type PlanningSession, feedback, selectedDestinations, selectedRoutes, selectedUnits, selecting, selectionOf, withDraft } from "./selection";

/**
 * Picks the order type for the selected armies (U4: from the selection bar). Move starts choosing
 * its destination. Entrench and Rest cancel the moves of the selected armies they fit (O2, O5).
 * Once an order is given, nothing is selected (note 11).
 */
export function chooseOrder(scenario: Scenario, session: PlanningSession, orderKind: OrderKind): PlanningSession {
  if (session.draft.selectedUnitIds.length === 0) {
    return feedback(session, "Select at least one unit first.");
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
      return chooseStanding(session, orderKind);
  }
}

/** C1: Attack (Hold for demoralized armies) is the default in contested ground; choosing it drops planned withdrawals. */
function chooseDefault(session: PlanningSession, kind: "attack" | "hold"): PlanningSession {
  const chosen = new Set(session.draft.selectedUnitIds);
  const orders = session.draft.orders.filter((order) => !chosen.has(order.unitId));
  const draft = afterOrder(session.draft.selectedTerritoryId, orders);
  const who = chosen.size === 1 ? "1 unit" : `${String(chosen.size)} units`;
  return withDraft(session, { ...draft, ...unitOrdersWithout(session.draft, chosen), ...toldToStay(session.draft, chosen), feedback: `${who} will ${kind === "attack" ? "attack where they stand" : "hold"}.` });
}

/** C1, P6: Withdraw. With one way out it is planned at once; with several, the player picks a highlighted territory. */
function chooseWithdraw(scenario: Scenario, session: PlanningSession): PlanningSession {
  const routes = selectedWithdrawRoutes(scenario, session);
  const [only] = routes;
  if (only === undefined) return feedback(session, "These units have no way out through your own sub-territories.");
  const choosing = withDraft(session, { ...selectionOf(session.draft), stage: { orderKind: "withdraw", step: "choose-destination" } });
  return routes.length === 1 ? chooseDestination(scenario, choosing, only.to) : choosing;
}

function chooseStanding(session: PlanningSession, kind: StandingOrder): PlanningSession {
  const fitting = new Set(selectedUnits(session).filter((unit) => standingOrder(unit) === kind).map((unit) => unit.id));
  if (fitting.size === 0) {
    return feedback(session, kind === "entrench" ? "Demoralized units cannot entrench. They rest instead." : "Only demoralized units rest.");
  }
  const orders = session.draft.orders.filter((order) => !fitting.has(order.unitId));
  const draft = { ...afterOrder(session.draft.selectedTerritoryId, orders), ...unitOrdersWithout(session.draft, fitting), ...toldToStay(session.draft, fitting) };
  const who = fitting.size === 1 ? "1 unit" : `${String(fitting.size)} units`;
  return withDraft(session, { ...draft, feedback: `${who} will ${kind === "entrench" ? "entrench" : "rest"}.` });
}

function chooseMove(scenario: Scenario, session: PlanningSession): PlanningSession {
  const choosing = withDraft(session, { ...selectionOf(session.draft), stage: { orderKind: "move", step: "choose-destination" } });
  return selectedDestinations(scenario, choosing).length === 0
    ? feedback(session, "These units cannot move anywhere together this turn.")
    : choosing;
}

/** Leaves the order or destination choice and keeps the armies selected. */
export function cancelOrder(session: PlanningSession): PlanningSession {
  return withDraft(session, selectionOf(session.draft));
}

/**
 * Choosing a legal destination plans the move immediately; there is no separate confirm step.
 * It replaces any move a selected army already had. The origin stays open with nothing selected
 * (note 11).
 */
export function chooseDestination(scenario: Scenario, session: PlanningSession, territoryId: TerritoryId): PlanningSession {
  const origin = session.draft.selectedTerritoryId;
  if (session.draft.stage?.step !== "choose-destination" || origin === undefined) {
    return feedback(session, "Select units and choose Move first.");
  }
  if (territoryId === origin) {
    return feedback(session, "Choose a different territory as the destination.");
  }
  const withdrawing = session.draft.stage.orderKind === "withdraw";
  if (!selectedDestinations(scenario, session).includes(territoryId)) {
    return feedback(session, withdrawing ? "Withdraw to a highlighted territory: one you hold whole, reached through your own sub-territories." : refusal(scenario, session, origin, territoryId));
  }
  // CT-6: a plain land step keeps no legs; rail, sea and marches carry theirs (M4).
  const route = withdrawing ? undefined : selectedRoutes(scenario, session)?.get(territoryId);
  const legs = route === undefined || route.shape === "step" ? undefined : route.legs;
  const planned: PlannedOrder[] = session.draft.selectedUnitIds.map((unitId): MoveOrder | WithdrawOrder => (withdrawing ? {
    factionId: session.factionId,
    from: origin,
    kind: "withdraw",
    to: territoryId,
    unitId
  } : {
    factionId: session.factionId,
    from: origin,
    kind: "move",
    ...(legs === undefined ? {} : { legs }),
    to: territoryId,
    unitId
  }));
  const replanned = new Set(session.draft.selectedUnitIds);
  const orders = [...session.draft.orders.filter((order) => !replanned.has(order.unitId)), ...planned];
  // A move replaces a stay order given earlier (U2).
  return withDraft(session, { ...afterOrder(origin, orders), ...unitOrdersWithout(session.draft, replanned), ...stayWithout(session.draft, [...replanned]) });
}

/** Note 11: after an order the territory stays open and nothing is selected. */
export function afterOrder(territoryId: TerritoryId | undefined, orders: readonly PlannedOrder[]): Draft {
  return territoryId === undefined ? { orders, selectedUnitIds: [] } : selecting(territoryId, [], orders);
}

/** U2: the draft's armies told to stay, with these added. */
function toldToStay(draft: Draft, unitIds: ReadonlySet<UnitId>): Pick<Draft, "orderedToStay"> {
  return { orderedToStay: [...(draft.orderedToStay ?? []).filter((id) => !unitIds.has(id)), ...unitIds] };
}

/** U2: the draft's armies told to stay, less these (their order was cleared). */
export function stayWithout(draft: Draft, unitIds: readonly UnitId[]): Pick<Draft, "orderedToStay"> {
  return draft.orderedToStay === undefined ? {} : { orderedToStay: draft.orderedToStay.filter((id) => !unitIds.includes(id)) };
}

/** Clears a unit's move, Replenish, Disband or stay order, which returns it to its standing order (O5). */
export function removeOrder(session: PlanningSession, unitId: UnitId): PlanningSession {
  // The feedback was about the order being cleared, so it goes too.
  const draft: Draft = { ...session.draft };
  delete (draft as { feedback?: string }).feedback;
  return withDraft(session, {
    ...draft,
    orders: session.draft.orders.filter((order) => order.unitId !== unitId),
    ...unitOrdersWithout(session.draft, [unitId]),
    ...stayWithout(session.draft, [unitId])
  });
}

/** Why the selected armies cannot move to `to`: full trains, no connection, or the engine's own reason. */
function refusal(scenario: Scenario, session: PlanningSession, from: TerritoryId, to: TerritoryId): string {
  // D5: a ride is there, but its trains can't take the units whole.
  const full = selectionFullTrains(scenario, session.game.state, session.factionId, from, session.draft.selectedUnitIds, session.draft.orders.filter(isMoveOrder)).get(to);
  if (full !== undefined) return railShortageText(scenario, full);
  if (!isNeighbor(scenario, from, to)) {
    return `${requireTerritory(scenario, to).name} is not connected to ${requireTerritory(scenario, from).name}. Choose a highlighted territory.`;
  }
  const reasons = session.draft.selectedUnitIds.flatMap((unitId) => {
    const validation = validateMoveOrder(scenario, session.game.state, { factionId: session.factionId, from, kind: "move", to, unitId });
    return validation.ok ? [] : [validation.reason];
  });
  return reasons[0] ?? "These units cannot move there together. Choose a highlighted territory.";
}
