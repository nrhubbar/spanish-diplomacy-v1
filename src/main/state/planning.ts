import { isNeighbor, requireTerritory } from "../engine/lookup";
import type { MoveOrder, Scenario, TerritoryId, UnitId } from "../engine/types";
import { legalDestinations, validateMoveOrder } from "../engine/validation";
import type { Draft, OrderKind, Session } from "./session";

export type PlanningSession = Extract<Session, { readonly phase: "planning" }>;

/** The order types offered for the selected armies, in menu order. */
export const orderKinds: readonly OrderKind[] = ["move"];

/**
 * Draft editing for the active local player. Every rule question is answered by the engine;
 * these functions only manage selection state and inline feedback.
 *
 * Selection rule: selecting a territory selects all of the player's armies there that have no
 * order yet; the player then unselects the ones that should stay. Any change to the selection
 * closes an open order choice, so an order never applies to a stale selection.
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

function ownUnitIdsIn(session: PlanningSession, territoryId: TerritoryId): readonly UnitId[] {
  return Object.values(session.game.state.units)
    .filter((unit) => unit.factionId === session.factionId && unit.territoryId === territoryId)
    .map((unit) => unit.id);
}

/** The player's armies in a territory that have no order in `orders`. */
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
    : available.length === 0 ? "Every army here already has an order." : undefined;
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
  if (session.draft.orders.some((order) => order.unitId === unitId)) {
    return feedback(session, "Remove this army's planned order before giving it another.");
  }
  const current = session.draft.selectedUnitIds;
  return withDraft(session, selectionOf(
    session.draft,
    current.includes(unitId) ? current.filter((id) => id !== unitId) : [...current, unitId]
  ));
}

/** Restores the default selection: every army in the territory without an order. */
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

/** Picks the order type for the selected armies and starts choosing its target. */
export function chooseOrder(scenario: Scenario, session: PlanningSession, orderKind: OrderKind): PlanningSession {
  if (session.draft.selectedUnitIds.length === 0) {
    return feedback(session, "Select at least one army first.");
  }
  const choosing = withDraft(session, { ...selectionOf(session.draft), stage: { orderKind, step: "choose-destination" } });
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
 * The origin stays selected with its remaining unordered armies, following the selection rule.
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
  const orders = [...session.draft.orders, ...planned];
  return withDraft(session, selecting(origin, availableUnitIds(session, origin, orders), orders));
}

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
