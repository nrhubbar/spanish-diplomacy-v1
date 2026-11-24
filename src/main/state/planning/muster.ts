import { validateAirMission } from "../../engine/air/validation";
import type { AirMissionOrder, FactionId, Scenario, TerritoryId, UnitId } from "../../engine/types";
import type { MoveMode } from "../../engine/network/reach";
import { moveOrders, type Muster, muster, type MusterKind, type MusterMove, type MusterPicks } from "../../presentation/muster";
import { plannedSupport } from "../../presentation/odds";
import { territoryName } from "../../presentation/text";
import type { MusterChoices, PaneView } from "../paneSlice";
import type { Draft, PlannedOrder } from "../session";
import { airDraftOrders, isAircraft } from "./air";
import { draftWithMoves, movesRefusal } from "./orders";
import { unitOrdersWithout } from "./recruitment";
import { type PlanningSession, withDraft } from "./selection";

/**
 * U6: what the Invade or Reinforce pane orders: every ticked unit moves to the target by the
 * mode its card shows, and (Invade) every ticked aircraft flies Ground Support over it. Units
 * and aircraft that were ordered there before and are no longer ticked have that order cleared.
 */
export interface MusterOrder {
  readonly kind: MusterKind;
  /** Each unit with its legs; none for a plain step (CT-6). */
  readonly moves: readonly MusterMove[];
  /** Units and aircraft the pane listed: only their orders to the target may be cleared. */
  readonly shown: readonly UnitId[];
  readonly support: readonly UnitId[];
  readonly target: TerritoryId;
}

export type { MusterPicks } from "../../presentation/muster";

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function flightsOf(factionId: FactionId, order: MusterOrder): readonly AirMissionOrder[] {
  return order.support.map((unitId) => ({ factionId, kind: "air-mission", mission: { kind: "support", territoryId: order.target }, unitId }));
}

/** The draft's orders the pane's order keeps: those of units it neither sends nor clears. */
function keptOrders(draft: Draft, moving: ReadonlySet<UnitId>, order: MusterOrder): readonly PlannedOrder[] {
  const shown = new Set(order.shown);
  return draft.orders.filter((each) => !moving.has(each.unitId) && !(shown.has(each.unitId) && each.kind === "move" && each.to === order.target));
}

/**
 * U6: the engine's first refusal of the pane's moves and missions, or undefined when it takes
 * them all. The moves board their trains together or not at all, beside the orders kept (D5).
 */
export function musterRefusal(scenario: Scenario, { draft, factionId, game }: PlanningSession, order: MusterOrder): string | undefined {
  const { state } = game;
  const moves = moveOrders(state, factionId, order.target, order.moves);
  const refused = movesRefusal(scenario, state, moves, keptOrders(draft, new Set(moves.map((move) => move.unitId)), order));
  if (refused !== undefined) return refused;
  for (const flight of flightsOf(factionId, order)) {
    const verdict = validateAirMission(scenario, state, flight);
    if (!verdict.ok) return verdict.reason;
  }
  return undefined;
}

/**
 * U6: plans the pane's orders in one go. Each move and mission is checked by the engine first;
 * one refusal plans nothing and says why. A move replaces the unit's other order, Replenish or
 * stay (U2), and a mission replaces the aircraft's other mission. Orders to the target of units
 * the pane listed but left unticked are cleared. Nothing stays selected (note 11).
 */
export function orderMuster(scenario: Scenario, session: PlanningSession, order: MusterOrder): PlanningSession {
  const { factionId, game } = session;
  const refusal = musterRefusal(scenario, session, order);
  if (refusal !== undefined) return withDraft(session, { ...session.draft, feedback: refusal });
  const moves = moveOrders(game.state, factionId, order.target, order.moves);
  const flights = flightsOf(factionId, order);
  const moving = new Set(moves.map((move) => move.unitId));
  const flying = new Set(flights.map((flight) => flight.unitId));
  const shown = new Set(order.shown);
  const kept = keptOrders(session.draft, moving, order);
  const airOrders = (session.draft.airOrders ?? []).filter((each) => !flying.has(each.unitId)
    && !(shown.has(each.unitId) && each.kind === "air-mission" && each.mission.kind === "support" && each.mission.territoryId === order.target));
  const name = territoryName(scenario, order.target);
  const what = [moves.length === 0 ? "" : plural(moves.length, "unit", "units"), flights.length === 0 ? "" : plural(flights.length, "aircraft", "aircraft")].filter((part) => part !== "").join(" and ");
  const feedback = what === "" ? `No units are ordered to ${order.kind} ${name}.` : `${what} ordered to ${order.kind} ${name}.`;
  const draft: Draft = {
    ...draftWithMoves(session.draft, moves, kept),
    airOrders: [...airOrders, ...flights],
    feedback,
    ...unitOrdersWithout(session.draft, [...moving, ...flying])
  };
  return withDraft(session, draft);
}

/**
 * U6: what the pane has ticked: the units already ordered to the target and the aircraft already
 * on Ground Support over it, as the player has since changed them.
 */
export function musterPicks(scenario: Scenario, { draft, factionId, game }: PlanningSession, target: TerritoryId, { modes, ticks }: MusterChoices): MusterPicks {
  const ticked = (Object.entries(ticks) as [UnitId, boolean][]).flatMap(([id, on]) => (on ? [id] : []));
  const flies = (id: UnitId): boolean => isAircraft(scenario, game.state, id);
  const now = (ordered: readonly UnitId[], added: readonly UnitId[]): ReadonlySet<UnitId> =>
    new Set([...ordered.filter((id) => ticks[id] !== false), ...added]);
  return {
    modes: new Map(Object.entries(modes) as [UnitId, MoveMode][]),
    off: new Set((Object.entries(ticks) as [UnitId, boolean][]).flatMap(([id, on]) => (on ? [] : [id]))),
    support: now(plannedSupport(airDraftOrders(draft), factionId, target), ticked.filter(flies)),
    units: now(draft.orders.filter((order) => order.to === target).map((order) => order.unitId), ticked.filter((id) => !flies(id)))
  };
}

/**
 * The units and aircraft the Invade or Reinforce pane would order now, for the map to mark; none
 * in another view. A tick on a unit the pane no longer lists orders nothing, so it marks nothing.
 */
export function tickedOnMap(scenario: Scenario, session: PlanningSession, view: PaneView, choices: MusterChoices): ReadonlySet<UnitId> {
  if (view.kind !== "invade" && view.kind !== "reinforce") return new Set();
  const { draft, factionId, game } = session;
  const picks = musterPicks(scenario, session, view.target, choices);
  const listed = muster(scenario, game.state, factionId, view.target, view.kind, { airOrders: airDraftOrders(draft), orders: draft.orders }, picks);
  const { moves, support } = musterOrderFrom(listed, listed.picks);
  return new Set([...moves.map((move) => move.unitId), ...support]);
}

/** U6: the pane's picks as the order to give: each ticked unit with the legs of its chosen mode. */
export function musterOrderFrom(view: Muster, picks: MusterPicks): MusterOrder {
  const moves = view.groups.flatMap((group) => group.cards).filter((card) => picks.units.has(card.unitId)).flatMap((card): MusterMove[] => {
    // A chosen mode the card can't take falls back to the card's own; with none open, it stays.
    const okIn = (mode: MoveMode | undefined) => card.modes.find((each) => each.ok && each.mode === mode);
    const chip = okIn(picks.modes.get(card.unitId)) ?? okIn(card.chosen) ?? okIn(card.defaultMode);
    if (chip?.ok !== true) return [];
    return [chip.legs === undefined ? { unitId: card.unitId } : { legs: chip.legs, unitId: card.unitId }];
  });
  const shown = [...view.groups.flatMap((group) => group.cards.map((card) => card.unitId)), ...view.support.map((each) => each.unitId)];
  return { kind: view.kind, moves, shown, support: view.support.filter((each) => picks.support.has(each.unitId)).map((each) => each.unitId), target: view.target };
}
