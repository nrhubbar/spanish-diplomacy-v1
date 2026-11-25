import { isNeighbor } from "../../engine/lookup";
import { type StandingOrder, standingOrder } from "../../engine/orders";
import { boardingRefusal, railFullRefusal } from "../../engine/movement/routes";
import { judgePlannedMoves } from "../../engine/movement/transit";
import { type AirMissionOrder, type GameState, isMoveOrder, type MoveOrder, type SackOrder, type Scenario, type TerritoryId, type UnitId, type WithdrawOrder } from "../../engine/types";
import { validateMoveOrder } from "../../engine/validation";
import { type Feedback, refusedFeedback } from "../../presentation/feedback";
import { selectionFullTrains } from "../../presentation/movement";
import { orderLegs } from "../../presentation/moveModes";
import { moveTo } from "../../presentation/odds";
import type { Draft, OrderKind, PlannedOrder } from "../session";
import { isAircraft, leaveTargets } from "./air";
import { selectedWithdrawRoutes } from "./contested";
import { disbandableSelection, planDisband } from "./disband";
import { chooseReplenish, unitOrdersWithout } from "./recruitment";
import { type PlanningSession, feedback, selectedDestinations, selectedRoutes, selectedUnits, selecting, selectionOf, withDraft } from "./selection";

/**
 * Picks the order type for the selected armies (U4: from the selection bar). Move starts choosing
 * its destination. Entrench and Rest cancel the moves of the selected armies they fit (O2, O5).
 * Once an order is given, nothing is selected (note 11).
 */
export function chooseOrder(scenario: Scenario, session: PlanningSession, orderKind: OrderKind): PlanningSession {
  if (session.draft.selectedUnitIds.length === 0) {
    return feedback(session, { code: "no-units-selected" });
  }
  switch (orderKind) {
    case "move":
      return chooseMove(scenario, session);
    case "replenish":
      return chooseReplenish(scenario, session);
    case "disband":
      return chooseDisband(scenario, session);
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

/** N1: Disband for the selected units that can; a general or a unit going already stays as it is. Nothing is left selected (note 11). */
function chooseDisband(scenario: Scenario, session: PlanningSession): PlanningSession {
  const planned = planDisband(scenario, session, disbandableSelection(scenario, session));
  return withDraft(planned, { ...planned.draft, selectedUnitIds: [] });
}

/** C1: Attack (Hold for demoralized armies) is the default in contested ground; choosing it drops planned withdrawals. */
function chooseDefault(session: PlanningSession, kind: "attack" | "hold"): PlanningSession {
  const chosen = new Set(session.draft.selectedUnitIds);
  const orders = session.draft.orders.filter((order) => !chosen.has(order.unitId));
  const draft = afterOrder(session.draft.selectedTerritoryId, orders);
  return withDraft(session, { ...draft, ...unitOrdersWithout(session.draft, chosen), ...toldToStay(session.draft, chosen), feedback: { code: "stay-planned", order: kind, units: chosen.size } });
}

/** C1, P6: Withdraw. With one way out it is planned at once; with several, the player picks a highlighted territory. */
function chooseWithdraw(scenario: Scenario, session: PlanningSession): PlanningSession {
  const routes = selectedWithdrawRoutes(scenario, session);
  const [only] = routes;
  if (only === undefined) return feedback(session, { code: "no-way-out" });
  const choosing = withDraft(session, { ...selectionOf(session.draft), stage: { orderKind: "withdraw", step: "choose-destination" } });
  return routes.length === 1 ? chooseDestination(scenario, choosing, only.to) : choosing;
}

function chooseStanding(session: PlanningSession, kind: StandingOrder): PlanningSession {
  const fitting = new Set(selectedUnits(session).filter((unit) => standingOrder(unit) === kind).map((unit) => unit.id));
  if (fitting.size === 0) {
    return feedback(session, { code: kind === "entrench" ? "cannot-entrench" : "cannot-rest" });
  }
  const orders = session.draft.orders.filter((order) => !fitting.has(order.unitId));
  const draft = { ...afterOrder(session.draft.selectedTerritoryId, orders), ...unitOrdersWithout(session.draft, fitting), ...toldToStay(session.draft, fitting) };
  return withDraft(session, { ...draft, feedback: { code: "stay-planned", order: kind, units: fitting.size } });
}

function chooseMove(scenario: Scenario, session: PlanningSession): PlanningSession {
  const choosing = withDraft(session, { ...selectionOf(session.draft), stage: { orderKind: "move", step: "choose-destination" } });
  return selectedDestinations(scenario, choosing).length === 0
    ? feedback(session, { code: "cannot-move-together" })
    : choosing;
}

/** Leaves the order, destination or target choice and keeps the armies, or the aircraft, selected. */
export function cancelOrder(session: PlanningSession): PlanningSession {
  if (session.draft.stage?.step === "choose-target") return leaveTargets(session);
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
    return feedback(session, { code: "move-not-chosen" });
  }
  if (territoryId === origin) {
    return feedback(session, { code: "same-destination" });
  }
  const withdrawing = session.draft.stage.orderKind === "withdraw";
  if (!selectedDestinations(scenario, session).includes(territoryId)) {
    return feedback(session, withdrawing ? { code: "withdraw-target" } : refusal(scenario, session, origin, territoryId));
  }
  // CT-6: a plain land step keeps no legs; rail, sea and marches carry theirs (M4).
  const route = withdrawing ? undefined : selectedRoutes(scenario, session)?.get(territoryId);
  const legs = route === undefined ? undefined : orderLegs(route);
  const replanned = new Set(session.draft.selectedUnitIds);
  const kept = session.draft.orders.filter((order) => !replanned.has(order.unitId));
  if (withdrawing) {
    const withdrawals = session.draft.selectedUnitIds.map((unitId): WithdrawOrder => ({ factionId: session.factionId, from: origin, kind: "withdraw", to: territoryId, unitId }));
    return withDraft(session, draftWithMoves(session.draft, withdrawals, kept));
  }
  const moves = session.draft.selectedUnitIds.map((unitId) => moveTo(session.factionId, unitId, origin, territoryId, legs));
  const refused = movesRefusal(scenario, session.game.state, moves, kept);
  return refused === undefined ? withDraft(session, draftWithMoves(session.draft, moves, kept)) : feedback(session, refused);
}

/**
 * N3: why these moves can't be given beside the orders kept, or undefined when they can: the
 * engine's check of each order, then of their armies as the reveal will judge them (trains, trucks,
 * landings, and an army with no unit that can fight). Move and the Invade and Reinforce panes both
 * ask here, and give their orders with `draftWithMoves`.
 */
export function movesRefusal(scenario: Scenario, state: GameState, moves: readonly MoveOrder[], kept: readonly PlannedOrder[]): Feedback | undefined {
  for (const move of moves) {
    const verdict = validateMoveOrder(scenario, state, move);
    if (!verdict.ok) return refusedFeedback(verdict.refusal);
  }
  const others = kept.filter(isMoveOrder);
  const full = boardingRefusal(scenario, state, moves, others);
  if (full !== undefined) return refusedFeedback(full);
  const given = new Set(moves.map((move) => move.unitId));
  const held = judgePlannedMoves(scenario, state, [...others, ...moves]).find(({ army, cause }) => cause !== undefined && army.orders.some((order) => given.has(order.unitId)));
  return held?.cause === undefined ? undefined : { cause: held.cause, code: "held-back", from: held.army.orders[0].from, to: held.army.orders[0].to };
}

/** N3: the draft once these orders are given: they replace the units' Replenish, Disband and stay orders (U2), and nothing stays selected. */
export function draftWithMoves(draft: Draft, given: readonly PlannedOrder[], kept: readonly PlannedOrder[]): Draft {
  const ids = given.map((order) => order.unitId);
  return { ...afterOrder(draft.selectedTerritoryId, [...kept, ...given]), ...unitOrdersWithout(draft, ids), ...stayWithout(draft, ids) };
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
  delete (draft as { feedback?: unknown }).feedback;
  return withDraft(session, {
    ...draft,
    orders: session.draft.orders.filter((order) => order.unitId !== unitId),
    ...unitOrdersWithout(session.draft, [unitId]),
    ...stayWithout(session.draft, [unitId])
  });
}

/** The territories a draft's ground moves go to. */
function groundTargets(scenario: Scenario, { draft, game }: PlanningSession): ReadonlySet<TerritoryId> {
  return new Set(draft.orders.filter((order) => isMoveOrder(order) && !isAircraft(scenario, game.state, order.unitId)).map((order) => order.to));
}

/**
 * N3: Ground Support goes with the attack it was planned for. When a change to the draft takes away
 * the last ground move into a territory where none of the player's units stand, the Ground Support
 * planned over it is cancelled too, and the feedback says so. Every change to the draft passes
 * through here (`gameSlice`), so each way to cancel an order follows the same rule. Support planned
 * on its own, with no move there before or after, stays.
 */
export function cancelIdleSupport(scenario: Scenario, before: PlanningSession, after: PlanningSession): PlanningSession {
  const { factionId, game } = after;
  const still = groundTargets(scenario, after);
  const left = new Set([...groundTargets(scenario, before)].filter((to) => !still.has(to)
    && !Object.values(game.state.units).some((unit) => unit.factionId === factionId && unit.territoryId === to && !isAircraft(scenario, game.state, unit.id))));
  const planned = after.draft.airOrders ?? [];
  // A flight ordered by this very change is the player's choice, whatever it supports.
  const flying = new Set((before.draft.airOrders ?? []).flatMap((order) => (order.kind === "air-mission" && order.mission.kind === "support" ? [`${order.unitId}|${order.mission.territoryId}`] : [])));
  const idleAt = (order: AirMissionOrder | SackOrder): TerritoryId | undefined =>
    (order.kind === "air-mission" && order.mission.kind === "support" && left.has(order.mission.territoryId)
      && flying.has(`${order.unitId}|${order.mission.territoryId}`) ? order.mission.territoryId : undefined);
  const places = new Set(planned.flatMap((order) => idleAt(order) ?? []));
  if (places.size === 0) return after;
  const { feedback: told } = after.draft;
  return {
    ...after,
    draft: {
      ...after.draft,
      airOrders: planned.filter((order) => idleAt(order) === undefined),
      feedback: { ...(told === undefined ? {} : { before: told }), code: "support-cancelled", territoryIds: [...places] }
    }
  };
}

/** Why the selected armies cannot move to `to`: full trains, no connection, or the engine's own reason. */
function refusal(scenario: Scenario, session: PlanningSession, from: TerritoryId, to: TerritoryId): Feedback {
  // D5: a ride is there, but its trains can't take the units whole.
  const full = selectionFullTrains(scenario, session.game.state, session.factionId, from, session.draft.selectedUnitIds, session.draft.orders.filter(isMoveOrder)).get(to);
  if (full !== undefined) return refusedFeedback(railFullRefusal(full));
  if (!isNeighbor(scenario, from, to)) {
    return { code: "not-connected", from, to };
  }
  const reasons = session.draft.selectedUnitIds.flatMap((unitId) => {
    const validation = validateMoveOrder(scenario, session.game.state, { factionId: session.factionId, from, kind: "move", to, unitId });
    return validation.ok ? [] : [refusedFeedback(validation.refusal)];
  });
  return reasons[0] ?? { code: "unreachable-together" };
}
