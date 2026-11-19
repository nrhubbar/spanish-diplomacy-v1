import { isNeighbor, requireTerritory } from "../engine/lookup";
import { type StandingOrder, standingOrder } from "../engine/orders";
import type { MoveOrder, Scenario, TerritoryId, UnitId, UnitState } from "../engine/types";
import { legalDestinations, validateMoveOrder } from "../engine/validation";
import type { Draft, OrderKind, Session } from "./session";

export type PlanningSession = Extract<Session, { readonly phase: "planning" }>;

/** Menu order of the order types. */
const menuOrder: readonly OrderKind[] = ["move", "entrench", "rest"];

/**
 * The order types offered for the selected armies, in menu order (O2): Move, plus Entrench when
 * every selected army is healthy or Rest when every one is demoralized. A mixed selection is
 * offered Move only, so a healthy army is never offered Rest.
 */
export function orderKindsFor(session: PlanningSession): readonly OrderKind[] {
  const standing = new Set(selectedUnits(session).map(standingOrder));
  return menuOrder.filter((kind) => kind === "move" || (standing.size === 1 && standing.has(kind)));
}

/** The order an army has in the draft: its move, or else its standing order (O1, O5). */
export function orderOf(session: PlanningSession, unit: UnitState): OrderKind {
  return session.draft.orders.some((order) => order.unitId === unit.id) ? "move" : standingOrder(unit);
}

/** How many of the player's armies move, entrench, and rest under the draft. */
export function orderCounts(session: PlanningSession): Readonly<Record<OrderKind, number>> {
  const counts: Record<OrderKind, number> = { entrench: 0, move: 0, rest: 0 };
  for (const unit of Object.values(session.game.state.units)) {
    if (unit.factionId === session.factionId) counts[orderOf(session, unit)] += 1;
  }
  return counts;
}

/**
 * Draft editing for the active local player. Every rule question is answered by the engine;
 * these functions only manage selection state and inline feedback.
 *
 * Selection rule: selecting a territory selects all of the player's armies there that have no
 * move order, so they would entrench or rest; the player then unselects the ones that should
 * stay, or adds a moving army to change its order. Any change to the selection closes an open
 * order choice, so an order never applies to a stale selection.
 */
function withDraft(session: PlanningSession, draft: Draft): PlanningSession {
  return { ...session, draft };
}

function feedback(session: PlanningSession, message: string): PlanningSession {
  return withDraft(session, { ...session.draft, feedback: message });
}

/** A draft with a territory and armies selected, no order stage, and no feedback. */
function selecting(territoryId: TerritoryId, selectedUnitIds: readonly UnitId[], orders: readonly MoveOrder[]): Draft {
  return { orders, selectedTerritoryId: territoryId, selectedUnitIds };
}

/** The draft's current selection with its order stage and feedback dropped. */
function selectionOf(draft: Draft, selectedUnitIds = draft.selectedUnitIds): Draft {
  return draft.selectedTerritoryId === undefined
    ? { orders: draft.orders, selectedUnitIds }
    : selecting(draft.selectedTerritoryId, selectedUnitIds, draft.orders);
}

function selectedUnits(session: PlanningSession): readonly UnitState[] {
  return session.draft.selectedUnitIds.flatMap((id) => session.game.state.units[id] ?? []);
}

function ownUnitIdsIn(session: PlanningSession, territoryId: TerritoryId): readonly UnitId[] {
  return Object.values(session.game.state.units)
    .filter((unit) => unit.factionId === session.factionId && unit.territoryId === territoryId)
    .map((unit) => unit.id);
}

/** The player's armies in a territory that have no move order in `orders`. */
function availableUnitIds(session: PlanningSession, territoryId: TerritoryId, orders: readonly MoveOrder[]): readonly UnitId[] {
  const ordered = new Set(orders.map((order) => order.unitId));
  return ownUnitIdsIn(session, territoryId).filter((id) => !ordered.has(id));
}

export function selectedDestinations(scenario: Scenario, session: PlanningSession): readonly TerritoryId[] {
  if (session.draft.stage?.step !== "choose-destination") return [];
  return legalDestinations(scenario, session.game.state, session.factionId, session.draft.selectedUnitIds);
}

/** A map click means "select this territory" or, while choosing a destination, "move here". */
export function clickTerritory(scenario: Scenario, session: PlanningSession, territoryId: TerritoryId): PlanningSession {
  return session.draft.stage?.step === "choose-destination"
    ? chooseDestination(scenario, session, territoryId)
    : selectTerritory(session, territoryId);
}

/**
 * A map counter click. While choosing a destination it targets the counter's territory.
 * Otherwise an own army toggles (or selects its territory, if that is not selected yet), and
 * another faction's counter selects its territory.
 */
export function clickUnit(scenario: Scenario, session: PlanningSession, unitId: UnitId): PlanningSession {
  const unit = session.game.state.units[unitId];
  if (unit === undefined) return session;
  if (session.draft.stage?.step === "choose-destination") return chooseDestination(scenario, session, unit.territoryId);
  return unit.factionId === session.factionId ? toggleUnit(session, unitId) : selectTerritory(session, unit.territoryId);
}

export function selectTerritory(session: PlanningSession, territoryId: TerritoryId): PlanningSession {
  const own = ownUnitIdsIn(session, territoryId);
  const available = availableUnitIds(session, territoryId, session.draft.orders);
  const message = own.length === 0
    ? "None of your armies are in this territory."
    : available.length === 0 ? "Every army here is moving. Select one to change its order." : undefined;
  return withDraft(session, {
    ...selecting(territoryId, available, session.draft.orders),
    ...(message === undefined ? {} : { feedback: message })
  });
}

/** Toggles one army in the selected territory; an army elsewhere selects its territory instead. */
export function toggleUnit(session: PlanningSession, unitId: UnitId): PlanningSession {
  const unit = session.game.state.units[unitId];
  if (unit?.factionId !== session.factionId) {
    return feedback(session, "Select one of your own armies.");
  }
  if (session.draft.selectedTerritoryId !== unit.territoryId) {
    return selectTerritory(session, unit.territoryId);
  }
  const current = session.draft.selectedUnitIds;
  return withDraft(session, selectionOf(
    session.draft,
    current.includes(unitId) ? current.filter((id) => id !== unitId) : [...current, unitId]
  ));
}

/** Restores the default selection: every army in the territory without a move order. */
export function selectAllAvailable(session: PlanningSession): PlanningSession {
  const territoryId = session.draft.selectedTerritoryId;
  return territoryId === undefined
    ? feedback(session, "Select a territory first.")
    : selectTerritory(session, territoryId);
}

/** Unselects every army but keeps the territory open. */
export function clearSelection(session: PlanningSession): PlanningSession {
  return withDraft(session, selectionOf(session.draft, []));
}

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
  return orderKind === "move" ? chooseMove(scenario, session) : chooseStanding(session, orderKind);
}

function chooseStanding(session: PlanningSession, kind: StandingOrder): PlanningSession {
  const fitting = new Set(selectedUnits(session).filter((unit) => standingOrder(unit) === kind).map((unit) => unit.id));
  if (fitting.size === 0) {
    return feedback(session, kind === "entrench" ? "Demoralized armies cannot entrench. They rest instead." : "Only demoralized armies rest.");
  }
  const orders = session.draft.orders.filter((order) => !fitting.has(order.unitId));
  const territoryId = session.draft.selectedTerritoryId;
  const draft = territoryId === undefined
    ? { orders, selectedUnitIds: [] }
    : selecting(territoryId, availableUnitIds(session, territoryId, orders), orders);
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
  return withDraft(session, selecting(origin, availableUnitIds(session, origin, orders), orders));
}

/** Clears an army's move order, which returns it to its standing order (O5). */
export function removeOrder(session: PlanningSession, unitId: UnitId): PlanningSession {
  return withDraft(session, {
    ...session.draft,
    orders: session.draft.orders.filter((order) => order.unitId !== unitId)
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
