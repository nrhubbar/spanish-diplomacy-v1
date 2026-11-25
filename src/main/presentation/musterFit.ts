import { carrierCapacity } from "../engine/movement/allowance";
import { railCapacity } from "../engine/movement/network";
import { armyKey, plannedRoutes, railFullRefusal, usageOf } from "../engine/movement/routes";
import { armyRoute, judgePlannedMoves } from "../engine/movement/transit";
import type { MoveMode } from "../engine/network/reach";
import { type FactionId, type GameState, type HeldBackCause, isMoveOrder, type MoveLeg, type MoveOrder, type Scenario, type TerritoryId, type UnitId } from "../engine/types";
import type { ModeChip } from "./moveModes";
import type { Muster, MusterCard, MusterDraft, MusterGroup, MusterPicks } from "./muster";
import { moveTo } from "./odds";
import { subTerritoryName } from "./movement";
import { refusalText } from "./refusals";
import { territoryName } from "./text";

/**
 * Note 12: the Invade and Reinforce panes fitted to the units ticked. Each ticked unit's way is
 * judged as the reveal judges it (`judgePlannedMoves`), beside the orders kept and the other
 * ticked units, so trains, trucks, ports and generals' armies count while units are ticked and
 * the order button is never refused for something the pane let the player tick.
 */

type Way = readonly MoveLeg[] | undefined;

interface Chosen {
  readonly mode: MoveMode;
  readonly order: MoveOrder;
}

interface Fitter {
  /** Why the unit can't go this way beside these moves, or undefined when it can. */
  readonly cause: (order: MoveOrder, others: readonly MoveOrder[]) => HeldBackCause | undefined;
  readonly order: (card: MusterCard, way: Way) => MoveOrder;
}

function fitterOf(scenario: Scenario, state: GameState, factionId: FactionId, target: TerritoryId, kept: readonly MoveOrder[]): Fitter {
  // An army's route depends only on its units and legs, so it is worked out once.
  const routes = new Map<string, ReturnType<typeof armyRoute>>();
  const describe: Parameters<typeof judgePlannedMoves>[3] = (orders) => {
    const key = `${armyKey(scenario, orders[0])}|${orders.map((order) => order.unitId).sort().join(",")}`;
    const known = routes.get(key) ?? armyRoute(scenario, state, orders);
    routes.set(key, known);
    return known;
  };
  return {
    cause: (order, others) => judgePlannedMoves(scenario, state, [...kept, ...others, order], describe)
      .find(({ army }) => army.orders.some((each) => each.unitId === order.unitId))?.cause,
    order: (card, way) => moveTo(factionId, card.unitId, card.from, target, way)
  };
}

/** Why an army can't go, as a refusal before it is ordered. */
export function heldBackRefusal(scenario: Scenario, cause: HeldBackCause, from: TerritoryId, to: TerritoryId): string {
  switch (cause.reason) {
    case "allowance":
      return `${territoryName(scenario, to)} is further than these units can move this turn. By Motor, their trucks must carry every unit on foot.`;
    case "rail-full":
      return refusalText(scenario, railFullRefusal(cause.rail));
    case "port-landings":
      return `The port at ${territoryName(scenario, to)} has no room for another landing this turn.`;
    case "amphibious-lane":
      return `The sea lane to ${territoryName(scenario, to)} already carries a landing this turn.`;
    case "cannot-fight":
      return `It can't go alone: tick a unit in ${territoryName(scenario, from)} that can fight and goes the same way.`;
  }
}

/** Why a card can't take a mode now. The trains say how many of their places are used. */
function refusalFor(scenario: Scenario, state: GameState, card: MusterCard, to: TerritoryId, cause: HeldBackCause): string {
  if (cause.reason === "rail-full") {
    const { boarding, left, places } = cause.rail;
    const capacity = railCapacity(scenario, state, boarding);
    const own = scenario.index.subTerritories.get(boarding)?.territoryId === card.from ? "" : ` at ${subTerritoryName(scenario, boarding)}`;
    return `Trains full${own}: ${String(Math.min(capacity, capacity - left + places - 1))} of ${String(capacity)} places used.`;
  }
  if (cause.reason === "cannot-fight" && card.general) return `A general can't go alone: tick a unit in ${territoryName(scenario, card.from)} that can fight and goes the same way.`;
  if (cause.reason === "allowance") return "Motor needs trucks for every unit on foot, and there are too few.";
  return heldBackRefusal(scenario, cause, card.from, to);
}

/** The modes to try for a card, the one asked for first, then the one it starts on. */
function modesToTry(card: MusterCard, asked: MoveMode | undefined): readonly MoveMode[] {
  return [...new Set([...(asked === undefined ? [] : [asked]), card.defaultMode, ...card.options.map((option) => option.mode)])];
}

/** Every choice of mode and way for a card, in order. */
function waysOf(card: MusterCard, modes: readonly MoveMode[]): readonly { readonly mode: MoveMode; readonly way: Way }[] {
  return modes.flatMap((mode) => card.options.filter((option) => option.mode === mode).flatMap((option) => option.ways.map((way) => ({ mode, way }))));
}

/** The carriers a unit could take by Motor: from its territory, free, and able to go the same way; the largest first. */
function freeCarriers(scenario: Scenario, state: GameState, cards: readonly MusterCard[], card: MusterCard, taken: ReadonlySet<UnitId>, off: ReadonlySet<UnitId>): readonly MusterCard[] {
  return cards
    .filter((each) => each.carrier && each.from === card.from && each.unitId !== card.unitId && each.otherOrder === undefined && !taken.has(each.unitId) && !off.has(each.unitId))
    .sort((a, b) => carrierCapacity(scenario, state, b.unitId) - carrierCapacity(scenario, state, a.unitId));
}

/** The first way a card can go beside the units chosen, with the carriers it takes along. */
function firstWay(scenario: Scenario, state: GameState, fitter: Fitter, cards: readonly MusterCard[], card: MusterCard, modes: readonly MoveMode[], chosen: ReadonlyMap<UnitId, Chosen>, off: ReadonlySet<UnitId>): ReadonlyMap<UnitId, Chosen> | undefined {
  const others = [...chosen.values()].map((each) => each.order);
  for (const { mode, way } of waysOf(card, modes)) {
    const order = fitter.order(card, way);
    const cause = fitter.cause(order, others);
    if (cause === undefined) return new Map([[card.unitId, { mode, order }]]);
    if (cause.reason !== "allowance" || card.companion) continue;
    const taken = new Map<UnitId, Chosen>();
    for (const carrier of freeCarriers(scenario, state, cards, card, new Set(chosen.keys()), off)) {
      taken.set(carrier.unitId, { mode, order: fitter.order(carrier, way) });
      if (fitter.cause(order, [...others, ...[...taken.values()].map((each) => each.order)]) === undefined) return new Map([...taken, [card.unitId, { mode, order }]]);
    }
  }
  return undefined;
}

/** The orders the pane's own leave alone: the side's moves but those of the units ticked, and those of listed units to the target. */
export function keptMoves(draft: MusterDraft, target: TerritoryId, listed: ReadonlySet<UnitId>, ticked: ReadonlySet<UnitId>): readonly MoveOrder[] {
  return draft.orders.filter(isMoveOrder).filter((order) => !(listed.has(order.unitId) && (order.to === target || ticked.has(order.unitId))));
}

const cardsOf = (view: Pick<Muster, "groups">): readonly MusterCard[] => view.groups.flatMap((group) => group.cards);

/** Ticked units in the order they were ticked, those that lead an army before those that only go along. */
function inOrder(cards: readonly MusterCard[], units: ReadonlySet<UnitId>): readonly MusterCard[] {
  const ticked = [...units].flatMap((id) => cards.filter((card) => card.unitId === id));
  return [...ticked.filter((card) => !card.companion), ...ticked.filter((card) => card.companion)];
}

/** Note 12: the view with every card's modes, tick and reasons as they are beside the units ticked. */
export function fitMuster(scenario: Scenario, state: GameState, factionId: FactionId, view: Muster, picks: MusterPicks, draft: MusterDraft): Muster {
  const cards = cardsOf(view);
  const off = picks.off ?? new Set<UnitId>();
  const kept = keptMoves(draft, view.target, new Set(cards.map((card) => card.unitId)), picks.units);
  const fitter = fitterOf(scenario, state, factionId, view.target, kept);
  const chosen = new Map<UnitId, Chosen>();
  for (const card of inOrder(cards, picks.units)) {
    if (chosen.has(card.unitId)) continue;
    const found = firstWay(scenario, state, fitter, cards, card, modesToTry(card, picks.modes.get(card.unitId)), chosen, off);
    for (const [unitId, each] of found ?? []) chosen.set(unitId, each);
  }
  const fitCard = (card: MusterCard): MusterCard => {
    const own = chosen.get(card.unitId);
    const rest = new Map([...chosen].filter(([unitId]) => unitId !== card.unitId));
    const modes = card.options.map((option): ModeChip => {
      if (own?.mode === option.mode) return { ...(own.order.legs === undefined ? {} : { legs: own.order.legs }), mode: option.mode, ok: true };
      const found = firstWay(scenario, state, fitter, cards, card, [option.mode], rest, off)?.get(card.unitId);
      if (found !== undefined) return { ...(found.order.legs === undefined ? {} : { legs: found.order.legs }), mode: option.mode, ok: true };
      const [way] = option.ways;
      const cause = option.ways.length === 0 ? undefined : fitter.cause(fitter.order(card, way), [...rest.values()].map((each) => each.order));
      return { mode: option.mode, ok: false, ...(cause === undefined ? { reason: option.reason } : { full: true, reason: refusalFor(scenario, state, card, view.target, cause) }) };
    });
    const open = modes.filter((chip) => chip.ok).map((chip) => chip.mode);
    const refusal = modes.find((chip) => !chip.ok && chip.mode === card.defaultMode) ?? modes.find((chip) => !chip.ok && chip.full === true);
    return {
      ...card,
      ...(open.length === 0 && refusal?.ok === false ? { blocked: refusal.reason } : {}),
      chosen: own?.mode ?? modesToTry(card, picks.modes.get(card.unitId)).find((mode) => open.includes(mode)) ?? card.defaultMode,
      modes
    };
  };
  const orders = [...kept, ...[...chosen.values()].map((each) => each.order)];
  return {
    ...view,
    groups: view.groups.map((group): MusterGroup => ({ ...group, cards: group.cards.map(fitCard), trains: trainsOf(scenario, state, factionId, view.target, group, orders) })),
    picks: { ...picks, modes: new Map([...picks.modes, ...[...chosen].map(([unitId, each]): [UnitId, MoveMode] => [unitId, each.mode])]), units: new Set(chosen.keys()) }
  };
}

/** The places used on the trains a group's units could board: "Rail: 3 of 4 places", named when it isn't their own station. */
function trainsOf(scenario: Scenario, state: GameState, factionId: FactionId, target: TerritoryId, group: MusterGroup, orders: readonly MoveOrder[]): readonly string[] {
  const rides = group.cards.filter((card) => !card.companion || card.carrier).flatMap((card) => card.options.filter((option) => option.mode === "rail").flatMap((option) => option.ways.slice(0, 1)
    .map((way) => moveTo(factionId, card.unitId, card.from, target, way))));
  const { departures } = usageOf(plannedRoutes(scenario, state, orders));
  return [...usageOf(plannedRoutes(scenario, state, rides)).departures.keys()].map((boarding) => {
    const own = scenario.index.subTerritories.get(boarding)?.territoryId === group.from ? "" : ` at ${subTerritoryName(scenario, boarding)}`;
    return `Rail${own}: ${String(departures.get(boarding) ?? 0)} of ${String(railCapacity(scenario, state, boarding))} places`;
  });
}

/** What Select all sets: a tick (or an untick) and a mode for each unit and aircraft it covers. */
export interface MusterSelection {
  readonly modes: Readonly<Partial<Record<UnitId, MoveMode>>>;
  readonly ticks: Readonly<Partial<Record<UnitId, boolean>>>;
}

const byStrength = (a: MusterCard, b: MusterCard): number => b.strength - a.strength;

/** The cards Select all would tick: those that can go, with no other order; one general in all, and no carriers for their own sake. */
function selectable(view: Muster, from: TerritoryId | undefined): readonly MusterCard[] {
  const led = cardsOf(view).some((card) => card.general && view.picks.units.has(card.unitId));
  return cardsOf(view).filter((card) => (from === undefined || card.from === from)
    && card.otherOrder === undefined && !card.carrier && !(card.general && led) && !view.picks.units.has(card.unitId));
}

/** The aircraft Select all would have ticked: those ticked now, then the free ones, up to the cap. */
function selectedSupport(view: Muster, picks: MusterPicks): readonly UnitId[] {
  const free = view.support.filter((each) => each.otherMission === undefined && !picks.support.has(each.unitId));
  return [...picks.support, ...free.map((each) => each.unitId)].slice(0, view.supportMax);
}

/** Whether all that Select all covers is ticked already, so pressing it clears. Nothing ticked is never all. */
export function allSelected(view: Muster, picks: MusterPicks, from?: TerritoryId): boolean {
  const ticked = cardsOf(view).some((card) => (from === undefined || card.from === from) && picks.units.has(card.unitId));
  return (ticked || (from === undefined && picks.support.size > 0)) && selectable(view, from).every((card) => card.blocked !== undefined)
    && (from !== undefined || selectedSupport(view, picks).every((id) => picks.support.has(id)));
}

/**
 * Note 12: Select all, for the whole pane or one group (`from`). Every unit that can go and has no
 * other order is ticked, the strongest first, each by the best mode its trains still take; with
 * them the best general of those that could go along and, for the whole pane, aircraft up to the
 * Ground Support cap. Trucks come only as the ticked units need them. When all it covers is ticked
 * already, it clears them.
 */
export function selectAll(scenario: Scenario, state: GameState, factionId: FactionId, view: Muster, picks: MusterPicks, draft: MusterDraft, from?: TerritoryId): MusterSelection {
  const cards = cardsOf(view);
  const everything = from === undefined;
  if (allSelected(view, picks, from)) {
    const covered = cards.filter((card) => everything || card.from === from).map((card) => card.unitId);
    return { modes: {}, ticks: Object.fromEntries([...covered, ...(everything ? view.support.map((each) => each.unitId) : [])].map((id) => [id, false])) };
  }
  const free = selectable(view, from);
  const ids = (some: readonly MusterCard[]): readonly UnitId[] => [...some].sort(byStrength).map((card) => card.unitId);
  // What is ticked already stays as it is.
  const current = inOrder(cards, view.picks.units).map((card) => card.unitId);
  const fit = (units: readonly UnitId[]): MusterPicks => fitMuster(scenario, state, factionId, view, { modes: view.picks.modes, support: picks.support, units: new Set(units) }, draft).picks;
  let result = fit([...current, ...ids(free.filter((card) => !card.companion && !card.general)), ...ids(free.filter((card) => card.companion && !card.general))]);
  for (const general of ids(free.filter((card) => card.general))) {
    const led = fit([...result.units, general]);
    if (!led.units.has(general)) continue;
    result = led;
    break;
  }
  return {
    modes: Object.fromEntries([...result.modes].filter(([id]) => result.units.has(id))),
    ticks: Object.fromEntries([...result.units, ...(everything ? selectedSupport(view, picks) : [])].map((id) => [id, true]))
  };
}
