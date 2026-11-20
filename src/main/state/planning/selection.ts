import { standingOrder } from "../../engine/orders";
import { isMoveOrder, type ReplenishOrder, type Scenario, type TerritoryId, type UnitId, type UnitState } from "../../engine/types";
import type { MoveRoute } from "../../engine/movement/routes";
import { legalDestinations } from "../../engine/validation";
import { selectionRoutes } from "../../presentation/movement";
import type { Draft, OrderKind, PlannedOrder, Session } from "../session";
import { isAircraft, keepAirOrders, selectAircraft } from "./air";
import { inContestedGround, withdrawDestinations } from "./contested";
import { chooseDestination } from "./orders";
import { canReplenishSelection, keepBasket } from "./recruitment";

export type PlanningSession = Extract<Session, { readonly phase: "planning" }>;

/** Menu order of the order types. */
const menuOrder: readonly OrderKind[] = ["replenish", "move", "entrench", "rest"];

/**
 * The order types offered for the selected armies, in menu order (O2): Move, plus Entrench when
 * every selected army is healthy or Rest when every one is demoralized. A mixed selection is
 * offered Move only, so a healthy army is never offered Rest.
 */
export function orderKindsFor(session: PlanningSession, scenario?: Scenario): readonly OrderKind[] {
  const units = selectedUnits(session);
  // C1: in contested ground the choice is Attack (the default) or Withdraw (m3r1-sub-territories).
  if (units.length > 0 && units.every((unit) => inContestedGround(scenario, session, unit))) return ["attack", "withdraw"];
  const standing = new Set(units.map(standingOrder));
  // R5 (m3r1-recruit-replenish): Replenish leads the menu when every selected unit may take it.
  const replenish = scenario !== undefined && canReplenishSelection(scenario, session);
  return menuOrder.filter((kind) => kind === "move" || (kind === "replenish" ? replenish : standing.size === 1 && standing.has(kind as "entrench" | "rest")));
}

/**
 * The order an army has in the draft: its move, withdrawal or Replenish, or else its default:
 * Attack in contested ground (Hold when demoralized, C1, C4), otherwise its standing order (O1, O5).
 */
export function orderOf(session: PlanningSession, unit: UnitState, scenario?: Scenario): OrderKind {
  const planned = session.draft.orders.find((order) => order.unitId === unit.id);
  if (planned !== undefined) return planned.kind;
  if (session.draft.replenishments?.some((order) => order.unitId === unit.id) === true) return "replenish";
  if (inContestedGround(scenario, session, unit)) return unit.morale.demoralized ? "hold" : "attack";
  return standingOrder(unit);
}

/** How many of the player's armies move, replenish, entrench, and rest under the draft; contested-ground kinds appear once used. */
export function orderCounts(session: PlanningSession, scenario?: Scenario): Readonly<Partial<Record<OrderKind, number>> & Record<"entrench" | "move" | "replenish" | "rest", number>> {
  const counts: Partial<Record<OrderKind, number>> & Record<"entrench" | "move" | "replenish" | "rest", number> = { entrench: 0, move: 0, replenish: 0, rest: 0 };
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
  // The Recruit basket, Replenish orders (m3r1-recruit-replenish), air missions and sackings (m3r1-air-generals) outlive selection changes unless the new draft sets them.
  return { ...session, draft: { ...keepBasket(session.draft), ...keepAirOrders(session.draft), ...draft } };
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

function ownUnitIdsIn(session: PlanningSession, territoryId: TerritoryId, scenario?: Scenario): readonly UnitId[] {
  // U2: aircraft are selected on their own (`planning/air.ts`), never with the territory's units.
  return Object.values(session.game.state.units)
    .filter((unit) => unit.factionId === session.factionId && unit.territoryId === territoryId)
    .filter((unit) => scenario === undefined || !isAircraft(scenario, session.game.state, unit.id))
    .map((unit) => unit.id);
}

/** The player's armies in a territory that have no move or withdrawal in `orders`, nor a Replenish order (R5). Aircraft are left out when the scenario is given (U2). */
export function availableUnitIds(
  session: PlanningSession,
  territoryId: TerritoryId,
  orders: readonly PlannedOrder[],
  replenishments: readonly ReplenishOrder[] = session.draft.replenishments ?? [],
  scenario?: Scenario
): readonly UnitId[] {
  const ordered = new Set([...orders, ...replenishments].map((order) => order.unitId));
  return ownUnitIdsIn(session, territoryId, scenario).filter((id) => !ordered.has(id));
}

export function selectedDestinations(scenario: Scenario, session: PlanningSession): readonly TerritoryId[] {
  if (session.draft.stage?.step !== "choose-destination") return [];
  if (session.draft.stage.orderKind === "withdraw") return withdrawDestinations(scenario, session);
  const routes = selectedRoutes(scenario, session);
  if (routes !== undefined) return scenario.territories.map((territory) => territory.id).filter((id) => routes.has(id));
  return legalDestinations(scenario, session.game.state, session.factionId, session.draft.selectedUnitIds);
}

/** M1-M5: under `allowance`, the route offered for each destination of the selected units. */
export function selectedRoutes(scenario: Scenario, session: PlanningSession): ReadonlyMap<TerritoryId, MoveRoute> | undefined {
  const { draft } = session;
  return selectionRoutes(scenario, session.game.state, session.factionId, draft.selectedTerritoryId, draft.selectedUnitIds, draft.orders.filter(isMoveOrder));
}

/** A map click means "select this territory" or, while choosing a destination, "move here". */
export function clickTerritory(scenario: Scenario, session: PlanningSession, territoryId: TerritoryId): PlanningSession {
  return session.draft.stage?.step === "choose-destination"
    ? chooseDestination(scenario, session, territoryId)
    : selectTerritory(session, territoryId, scenario);
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
  if (unit.factionId === session.factionId && isAircraft(scenario, session.game.state, unitId)) return selectAircraft(session, unitId);
  return unit.factionId === session.factionId ? toggleUnit(session, unitId, scenario) : selectTerritory(session, unit.territoryId, scenario);
}

export function selectTerritory(session: PlanningSession, territoryId: TerritoryId, scenario?: Scenario): PlanningSession {
  const own = ownUnitIdsIn(session, territoryId, scenario);
  const available = availableUnitIds(session, territoryId, session.draft.orders, undefined, scenario);
  const message = own.length === 0
    ? "None of your units are in this territory."
    : available.length === 0 ? "Every unit here is moving. Select one to change its order." : undefined;
  return withDraft(session, {
    ...selecting(territoryId, available, session.draft.orders),
    ...(message === undefined ? {} : { feedback: message })
  });
}

/** Toggles one army in the selected territory; an army elsewhere selects its territory instead. */
export function toggleUnit(session: PlanningSession, unitId: UnitId, scenario?: Scenario): PlanningSession {
  const unit = session.game.state.units[unitId];
  if (unit?.factionId !== session.factionId) {
    return feedback(session, "Select one of your own units.");
  }
  if (session.draft.selectedTerritoryId !== unit.territoryId) {
    return selectTerritory(session, unit.territoryId, scenario);
  }
  const current = session.draft.selectedUnitIds;
  return withDraft(session, selectionOf(
    session.draft,
    current.includes(unitId) ? current.filter((id) => id !== unitId) : [...current, unitId]
  ));
}

/** Restores the default selection: every army in the territory without a move order. */
export function selectAllAvailable(session: PlanningSession, scenario?: Scenario): PlanningSession {
  const territoryId = session.draft.selectedTerritoryId;
  return territoryId === undefined
    ? feedback(session, "Select a territory first.")
    : selectTerritory(session, territoryId, scenario);
}

/** Unselects every army but keeps the territory open. */
export function clearSelection(session: PlanningSession): PlanningSession {
  return withDraft(session, selectionOf(session.draft, []));
}
