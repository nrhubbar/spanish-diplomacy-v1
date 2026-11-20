import { standingOrder } from "../../engine/orders";
import type { Scenario, TerritoryId, UnitId, UnitState } from "../../engine/types";
import { legalDestinations } from "../../engine/validation";
import type { Draft, OrderKind, PlannedOrder, Session } from "../session";
import { inContestedGround, withdrawDestinations } from "./contested";
import { chooseDestination } from "./orders";

export type PlanningSession = Extract<Session, { readonly phase: "planning" }>;

/** Menu order of the order types. */
const menuOrder: readonly OrderKind[] = ["move", "entrench", "rest"];

/**
 * The order types offered for the selected armies, in menu order (O2): Move, plus Entrench when
 * every selected army is healthy or Rest when every one is demoralized. A mixed selection is
 * offered Move only, so a healthy army is never offered Rest.
 */
export function orderKindsFor(session: PlanningSession, scenario?: Scenario): readonly OrderKind[] {
  const units = selectedUnits(session);
  // C1: in contested ground the choice is Attack (the default) or Withdraw.
  if (units.length > 0 && units.every((unit) => inContestedGround(scenario, session, unit))) return ["attack", "withdraw"];
  const standing = new Set(units.map(standingOrder));
  return menuOrder.filter((kind) => kind === "move" || (standing.size === 1 && standing.has(kind as "entrench" | "rest")));
}

/**
 * The order an army has in the draft: its move or withdrawal, or else its default: Attack in
 * contested ground (Hold when demoralized, C1, C4), otherwise its standing order (O1, O5).
 */
export function orderOf(session: PlanningSession, unit: UnitState, scenario?: Scenario): OrderKind {
  const planned = session.draft.orders.find((order) => order.unitId === unit.id);
  if (planned !== undefined) return planned.kind;
  if (inContestedGround(scenario, session, unit)) return unit.morale.demoralized ? "hold" : "attack";
  return standingOrder(unit);
}

/** How many of the player's armies move, entrench, and rest under the draft; contested-ground kinds appear once used. */
export function orderCounts(session: PlanningSession, scenario?: Scenario): Readonly<Partial<Record<OrderKind, number>> & Record<"entrench" | "move" | "rest", number>> {
  const counts: Partial<Record<OrderKind, number>> & Record<"entrench" | "move" | "rest", number> = { entrench: 0, move: 0, rest: 0 };
  for (const unit of Object.values(session.game.state.units)) {
    if (unit.factionId !== session.factionId) continue;
    const kind = orderOf(session, unit, scenario);
    counts[kind] = (counts[kind] ?? 0) + 1;
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
export function withDraft(session: PlanningSession, draft: Draft): PlanningSession {
  return { ...session, draft };
}

export function feedback(session: PlanningSession, message: string): PlanningSession {
  return withDraft(session, { ...session.draft, feedback: message });
}

/** A draft with a territory and armies selected, no order stage, and no feedback. */
export function selecting(territoryId: TerritoryId, selectedUnitIds: readonly UnitId[], orders: readonly PlannedOrder[]): Draft {
  return { orders, selectedTerritoryId: territoryId, selectedUnitIds };
}

/** The draft's current selection with its order stage and feedback dropped. */
export function selectionOf(draft: Draft, selectedUnitIds = draft.selectedUnitIds): Draft {
  return draft.selectedTerritoryId === undefined
    ? { orders: draft.orders, selectedUnitIds }
    : selecting(draft.selectedTerritoryId, selectedUnitIds, draft.orders);
}

export function selectedUnits(session: PlanningSession): readonly UnitState[] {
  return session.draft.selectedUnitIds.flatMap((id) => session.game.state.units[id] ?? []);
}

function ownUnitIdsIn(session: PlanningSession, territoryId: TerritoryId): readonly UnitId[] {
  return Object.values(session.game.state.units)
    .filter((unit) => unit.factionId === session.factionId && unit.territoryId === territoryId)
    .map((unit) => unit.id);
}

/** The player's armies in a territory that have no move order in `orders`. */
export function availableUnitIds(session: PlanningSession, territoryId: TerritoryId, orders: readonly PlannedOrder[]): readonly UnitId[] {
  const ordered = new Set(orders.map((order) => order.unitId));
  return ownUnitIdsIn(session, territoryId).filter((id) => !ordered.has(id));
}

export function selectedDestinations(scenario: Scenario, session: PlanningSession): readonly TerritoryId[] {
  if (session.draft.stage?.step !== "choose-destination") return [];
  if (session.draft.stage.orderKind === "withdraw") return withdrawDestinations(scenario, session);
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
