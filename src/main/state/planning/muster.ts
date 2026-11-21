import { validateAirMission } from "../../engine/air/validation";
import type { AirMissionOrder, FactionId, GameState, MoveLeg, MoveOrder, Scenario, TerritoryId, UnitId } from "../../engine/types";
import { validateMoveOrder } from "../../engine/validation";
import type { MoveMode } from "../../engine/network/reach";
import type { Muster, MusterKind } from "../../presentation/muster";
import { territoryName } from "../../presentation/text";
import type { Draft, PlannedOrder } from "../session";
import { afterOrder, stayWithout } from "./orders";
import { replenishWithout } from "./recruitment";
import { type PlanningSession, withDraft } from "./selection";

/**
 * U6: what the Invade or Reinforce pane orders: every ticked unit moves to the target by the
 * mode its card shows, and (Invade) every ticked aircraft flies Ground Support over it. Units
 * and aircraft that were ordered there before and are no longer ticked have that order cleared.
 */
export interface MusterOrder {
  readonly kind: MusterKind;
  /** Each unit with its legs; none for a plain step (CT-6). */
  readonly moves: readonly { readonly legs?: readonly MoveLeg[]; readonly unitId: UnitId }[];
  /** Units and aircraft the pane listed: only their orders to the target may be cleared. */
  readonly shown: readonly UnitId[];
  readonly support: readonly UnitId[];
  readonly target: TerritoryId;
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function movesOf(state: GameState, factionId: FactionId, order: MusterOrder): readonly MoveOrder[] {
  return order.moves.flatMap(({ legs, unitId }): MoveOrder[] => {
    const from = state.units[unitId]?.territoryId;
    return from === undefined ? [] : [{ factionId, from, kind: "move", ...(legs === undefined ? {} : { legs }), to: order.target, unitId }];
  });
}

function flightsOf(factionId: FactionId, order: MusterOrder): readonly AirMissionOrder[] {
  return order.support.map((unitId) => ({ factionId, kind: "air-mission", mission: { kind: "support", territoryId: order.target }, unitId }));
}

/** U6: the engine's first refusal of the pane's moves and missions, or undefined when it takes them all. */
export function musterRefusal(scenario: Scenario, state: GameState, factionId: FactionId, order: MusterOrder): string | undefined {
  for (const move of movesOf(state, factionId, order)) {
    const verdict = validateMoveOrder(scenario, state, move);
    if (!verdict.ok) return verdict.reason;
  }
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
  const refusal = musterRefusal(scenario, game.state, factionId, order);
  if (refusal !== undefined) return withDraft(session, { ...session.draft, feedback: refusal });
  const moves = movesOf(game.state, factionId, order);
  const flights = flightsOf(factionId, order);
  const moving = new Set(moves.map((move) => move.unitId));
  const flying = new Set(flights.map((flight) => flight.unitId));
  const shown = new Set(order.shown);
  const kept: PlannedOrder[] = session.draft.orders.filter((each) => !moving.has(each.unitId) && !(shown.has(each.unitId) && each.kind === "move" && each.to === order.target));
  const airOrders = (session.draft.airOrders ?? []).filter((each) => !flying.has(each.unitId)
    && !(shown.has(each.unitId) && each.kind === "air-mission" && each.mission.kind === "support" && each.mission.territoryId === order.target));
  const name = territoryName(scenario, order.target);
  const what = [moves.length === 0 ? "" : plural(moves.length, "unit", "units"), flights.length === 0 ? "" : plural(flights.length, "aircraft", "aircraft")].filter((part) => part !== "").join(" and ");
  const feedback = what === "" ? `No units are ordered to ${order.kind} ${name}.` : `${what} ordered to ${order.kind} ${name}.`;
  const draft: Draft = {
    ...afterOrder(session.draft.selectedTerritoryId, [...kept, ...moves]),
    airOrders: [...airOrders, ...flights],
    feedback,
    ...replenishWithout(session.draft, moving),
    ...stayWithout(session.draft, [...moving])
  };
  return withDraft(session, draft);
}

/** What the pane has ticked: units with their chosen modes, and aircraft. */
export interface MusterPicks {
  readonly modes: ReadonlyMap<UnitId, MoveMode>;
  readonly support: ReadonlySet<UnitId>;
  readonly units: ReadonlySet<UnitId>;
}

/** U6: the pane's picks as the order to give: each ticked unit with the legs of its chosen mode. */
export function musterOrderFrom(view: Muster, picks: MusterPicks): MusterOrder {
  const moves = view.groups.flatMap((group) => group.cards).filter((card) => picks.units.has(card.unitId)).map((card) => {
    // A chosen mode the card can't take falls back to the card's default, which it always can.
    const okIn = (mode: MoveMode | undefined) => card.modes.find((each) => each.ok && each.mode === mode);
    const chip = okIn(picks.modes.get(card.unitId)) ?? okIn(card.defaultMode);
    return chip?.ok === true && chip.legs !== undefined ? { legs: chip.legs, unitId: card.unitId } : { unitId: card.unitId };
  });
  const shown = [...view.groups.flatMap((group) => group.cards.map((card) => card.unitId)), ...view.support.map((each) => each.unitId)];
  return { kind: view.kind, moves, shown, support: view.support.filter((each) => picks.support.has(each.unitId)).map((each) => each.unitId), target: view.target };
}
