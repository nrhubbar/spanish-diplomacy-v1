import { describe, expect, it } from "vitest";
import { unitKindIn } from "../../main/engine/air/pieces";
import { capitalOf } from "../../main/engine/movement/network";
import { judgePlannedMoves } from "../../main/engine/movement/transit";
import { raisedUnitId } from "../../main/engine/recruitment/rules";
import { initialGameState } from "../../main/engine/resolution";
import { type GameState, type HeldBackCause, isMoveOrder, type RaisedUnitDefinition, type SubTerritoryId, type SubTerritoryState, type UnitId, type UnitTypeId } from "../../main/engine/types";
import { invadeOdds, muster, type Muster, type MusterCard, type MusterKind, type MusterPicks } from "../../main/presentation/muster";
import { isTruckType } from "../../main/engine/units/fighting";
import { allSelected, fitMuster, heldBackRefusal, selectAll } from "../../main/presentation/musterFit";
import { oddsSummary, plannedEstimates } from "../../main/presentation/odds";
import type { MusterChoices } from "../../main/state/paneSlice";
import { chooseDestination, clickTerritory, musterOrderFrom, musterPicks, musterRefusal, orderMuster, type PlanningSession, selectedEstimates } from "../../main/state/planning";
import type { Draft } from "../../main/state/session";
import { faction, move, spainWithAir, territory, unit } from "../support";

/** Note 12 and N4: the Invade and Reinforce panes fitted to the units ticked. */

const scenario = spainWithAir();
const start = initialGameState(scenario);
const republic = faction("republic");
const castile = territory("castilla-y-leon");
const madrid = territory("madrid");
const valencia = territory("valencia");
const wadRas = unit("rep-wad-ras-1");

const truckType = scenario.unitTypes.find(isTruckType)?.id ?? "";

const footType = scenario.unitTypes.find((type) => type.foot === true && type.attack > 0)?.id ?? "";

/** The state with extra units of a type raised in Madrid. */
function raised(type: string, count: number, state: GameState = start, territoryId = madrid): GameState {
  const ids = Array.from({ length: count }, (_, index) => raisedUnitId(republic, type as UnitTypeId, index + 1));
  const definition = (id: UnitId): RaisedUnitDefinition => ({ factionId: republic, fullStrength: 300, id, name: String(id), type: type as UnitTypeId });
  return {
    ...state,
    raised: { ...state.raised, ...Object.fromEntries(ids.map((id) => [id, definition(id)])) },
    units: { ...state.units, ...Object.fromEntries(ids.map((id) => [id, { factionId: republic, fatigue: 0, id, morale: { demoralized: false, quietTurns: 0 }, strength: 300, territoryId }])) }
  };
}

/** A general of the Republic, standing in Madrid. */
const generalId = Object.values(start.units).find((each) => each.factionId === republic && unitKindIn(scenario, start.raised, each.id) === "general")?.id as UnitId;
function withGeneral(state: GameState = start, territoryId = madrid): GameState {
  const general = state.units[generalId];
  if (general === undefined) throw new Error("fixture");
  return { ...state, units: { ...state.units, [generalId]: { ...general, territoryId } } };
}

/** Madrid's station boards this many units, and the station next door, where others could march and board, as few. */
function stations(state: GameState, places: number): GameState {
  const set = (id: string, rail: number): Record<string, SubTerritoryState> => {
    const capital = capitalOf(scenario, territory(id)) as SubTerritoryId;
    return { [capital]: { ...(state.subTerritories[capital] as SubTerritoryState), buildings: [], rail } };
  };
  return { ...state, subTerritories: { ...state.subTerritories, ...set("madrid", places / 2), ...set("castilla-la-mancha", 1) } };
}

function session(state: GameState = start, draft: Partial<Draft> = {}): PlanningSession {
  return { draft: { orders: [], selectedUnitIds: [], ...draft }, factionId: republic, game: { assignments: {}, history: [], locked: {}, scenarioId: scenario.id, seed: 1, state }, phase: "planning" };
}

const choices = (ticks: MusterChoices["ticks"], modes: MusterChoices["modes"] = {}): MusterChoices => ({ modes, ticks });

function paneOf(planning: PlanningSession, made: MusterChoices, kind: MusterKind = "invade", target = castile): { readonly picks: MusterPicks; readonly view: Muster } {
  const picks = musterPicks(scenario, planning, target, made);
  return { picks, view: muster(scenario, planning.game.state, republic, target, kind, { airOrders: planning.draft.airOrders ?? [], orders: planning.draft.orders }, picks) };
}

const cards = (view: Muster): readonly MusterCard[] => view.groups.flatMap((group) => group.cards);
const cardOf = (view: Muster, id: UnitId): MusterCard => {
  const found = cards(view).find((card) => card.unitId === id);
  if (found === undefined) throw new Error(`no card for ${id}`);
  return found;
};

describe("note 12: trains while ticking", () => {
  const crowded = stations(raised(footType, 1), 2);
  const inMadrid = cards(paneOf(session(crowded), choices({}), "reinforce", valencia).view).filter((card) => card.from === madrid && !card.general).map((card) => card.unitId);
  const pane = (ticked: readonly UnitId[], draft: Partial<Draft> = {}) => paneOf(session(crowded, draft), choices(Object.fromEntries(ticked.map((id) => [id, true]))), "reinforce", valencia);

  it("refuses the ride the ticked set would not leave a place for, and the tick when there is no other way", () => {
    expect(inMadrid).toHaveLength(5);
    const last = inMadrid[4] as UnitId;
    const one = pane(inMadrid.slice(0, 1));
    expect(one.view.groups.find((group) => group.from === madrid)?.trains).toEqual(["Rail: 1 of 2 places"]);
    // Two ride from Madrid and two march next door to board there.
    const four = pane(inMadrid.slice(0, 4));
    expect(four.view.picks.units.size).toBe(4);
    expect(cardOf(four.view, last)).toMatchObject({ blocked: "Trains full: 2 of 2 places used." });
    expect(cardOf(four.view, last).modes).toContainEqual({ full: true, mode: "rail", ok: false, reason: "Trains full: 2 of 2 places used." });
    // The ones that ride keep their place; one more does not go, and the order is never refused.
    const five = pane(inMadrid);
    expect([...five.view.picks.units]).toEqual(inMadrid.slice(0, 4));
    expect(musterRefusal(scenario, session(crowded), musterOrderFrom(five.view, five.view.picks))).toBeUndefined();
    // Unticking frees the place at once.
    expect(cardOf(pane(inMadrid.slice(1, 4)).view, last).blocked).toBeUndefined();
  });

  it("counts the trains other orders fill, until ticking their units frees them", () => {
    const given = orderMuster(scenario, session(crowded), (() => {
      const { view } = paneOf(session(crowded), choices(Object.fromEntries(inMadrid.slice(0, 4).map((id) => [id, true]))), "reinforce", valencia);
      return musterOrderFrom(view, view.picks);
    })()).draft.orders;
    expect(given).toHaveLength(4);
    const murcia = (ticked: readonly UnitId[]) => paneOf(session(crowded, { orders: given }), choices(Object.fromEntries(ticked.map((id) => [id, true]))), "reinforce", territory("murcia")).view;
    const last = inMadrid[4] as UnitId;
    expect(cardOf(murcia([]), last).blocked).toBe("Trains full: 2 of 2 places used.");
    expect(murcia(inMadrid.slice(0, 1)).picks.units.size).toBe(1);
    expect(musterRefusal(scenario, session(crowded, { orders: given }), musterOrderFrom(murcia(inMadrid.slice(0, 1)), murcia(inMadrid.slice(0, 1)).picks))).toBeUndefined();
  });

  it("never lets a sequence of ticks and modes make an order the engine refuses", () => {
    const state = stations(withGeneral(raised(truckType, 2)), 4);
    for (const [kind, target] of [["invade", castile], ["reinforce", valencia]] as const) {
      const all = cards(paneOf(session(state), choices({}), kind, target).view).map((card) => card.unitId);
      const ticks: Record<string, boolean> = {};
      const modes: Record<string, "march" | "motor" | "rail"> = {};
      for (let step = 0; step < 24; step += 1) {
        const id = all[(step * 7) % all.length] as UnitId;
        const now = paneOf(session(state), choices(ticks, modes), kind, target).view;
        if (cardOf(now, id).blocked === undefined || now.picks.units.has(id)) ticks[id] = !now.picks.units.has(id);
        const open = cardOf(now, id).modes.filter((chip) => chip.ok && chip.mode !== "sea");
        if (open.length > 0) modes[id] = open[step % open.length]?.mode as "march";
        const after = paneOf(session(state), choices(ticks, modes), kind, target).view;
        expect(musterRefusal(scenario, session(state), musterOrderFrom(after, after.picks))).toBeUndefined();
      }
    }
  });
});

describe("N4: generals in the pane", () => {
  const state = withGeneral();

  it("go with a unit that can fight, the same way, and never alone", () => {
    const alone = paneOf(session(state), choices({ [generalId]: true })).view;
    expect(alone.picks.units.size).toBe(0);
    expect(cardOf(alone, generalId)).toMatchObject({ blocked: "A general can't go alone: tick a unit in Madrid that can fight and goes the same way.", companion: true, general: true });
    expect(cardOf(alone, generalId).note).toMatch(/^General · \+\d on the battle roll of his army/);
    const led = paneOf(session(state), choices({ [generalId]: true, [wadRas]: true }, { [wadRas]: "rail" })).view;
    const order = musterOrderFrom(led, led.picks);
    expect(order.moves.find((each) => each.unitId === generalId)?.legs).toEqual(order.moves.find((each) => each.unitId === wadRas)?.legs);
    const given = orderMuster(scenario, session(state), order);
    expect(given.draft.orders).toHaveLength(2);
    expect(judgePlannedMoves(scenario, state, given.draft.orders.filter(isMoveOrder)).every(({ cause }) => cause === undefined)).toBe(true);
  });

  it("show the best one's bonus and trait in the ledger", () => {
    const odds = (ids: readonly UnitId[]) => {
      const view = paneOf(session(state), choices(Object.fromEntries(ids.map((id) => [id, true])))).view;
      return invadeOdds(scenario, state, republic, castile, musterOrderFrom(view, view.picks).moves, [], { orders: [] });
    };
    const without = odds([wadRas]);
    const withHim = odds([wadRas, generalId]);
    if (without.kind !== "battle" || withHim.kind !== "battle") throw new Error("battle");
    expect(JSON.stringify(without.ledger)).not.toContain("commands");
    expect(JSON.stringify(withHim.ledger)).toContain("José Miaja commands");
  });
});

describe("note 12: trucks", () => {
  it("come along with the units on foot that go by Motor, and not otherwise", () => {
    const state = raised(truckType, 1);
    const truck = raisedUnitId(republic, truckType as UnitTypeId, 1);
    const still = paneOf(session(state), choices({ [truck]: true })).view;
    expect(cardOf(still, truck)).toMatchObject({ blocked: "It can't go alone: tick a unit in Madrid that can fight and goes the same way.", carrier: true });
    const driven = paneOf(session(state), choices({ [wadRas]: true }, { [wadRas]: "motor" })).view;
    expect(cardOf(driven, wadRas).chosen).toBe("motor");
    expect(driven.picks.units.has(truck)).toBe(true);
    expect(musterRefusal(scenario, session(state), musterOrderFrom(driven, driven.picks))).toBeUndefined();
    // Left behind by hand, the unit can't drive and goes by its own mode.
    const unticked = paneOf(session(state), choices({ [truck]: false, [wadRas]: true }, { [wadRas]: "motor" })).view;
    expect(unticked.picks.units.has(truck)).toBe(false);
    expect(cardOf(unticked, wadRas).chosen).toBe("march");
    expect(cardOf(unticked, wadRas).modes.find((chip) => chip.mode === "motor")).toMatchObject({ full: true, reason: "Motor needs trucks for every unit on foot, and there are too few." });
  });

  it("makes Motor an offer only where transport could carry the unit", () => {
    expect(cardOf(paneOf(session(), choices({})).view, wadRas).modes.find((chip) => chip.mode === "motor")).toMatchObject({ ok: false, reason: expect.stringContaining("Motor needs trucks") as string });
  });
});

describe("note 12: Select all", () => {
  const draft = (planning: PlanningSession) => ({ airOrders: planning.draft.airOrders ?? [], orders: planning.draft.orders });
  const press = (planning: PlanningSession, made: MusterChoices, from?: typeof madrid) => {
    const { picks, view } = paneOf(planning, made);
    const chosen = selectAll(scenario, planning.game.state, republic, view, picks, draft(planning), from);
    return choices({ ...made.ticks, ...chosen.ticks }, { ...made.modes, ...chosen.modes });
  };

  it("ticks every free unit that can go, one general, and aircraft to the cap, and no truck; pressed again, it clears", () => {
    const state = withGeneral(raised(truckType, 2));
    const planning = session(state, { orders: [move("republic", "rep-madrid-security", "madrid", "castilla-la-mancha")] });
    const made = press(planning, choices({}));
    const { picks, view } = paneOf(planning, made);
    expect(view.picks.units.has(generalId)).toBe(true);
    expect(view.picks.units.has(wadRas)).toBe(true);
    expect(view.picks.units.has(unit("rep-madrid-security"))).toBe(false);
    expect(view.picks.units.has(raisedUnitId(republic, truckType as UnitTypeId, 1))).toBe(false);
    expect(picks.support.size).toBe(Math.min(view.supportMax ?? Infinity, view.support.length));
    expect(musterRefusal(scenario, planning, musterOrderFrom(view, view.picks))).toBeUndefined();
    expect(allSelected(view, picks)).toBe(true);
    // With nothing ticked there is nothing to clear, even when no unit can go.
    expect(allSelected({ ...view, groups: [] }, { ...picks, support: new Set(), units: new Set() })).toBe(false);
    const cleared = paneOf(planning, press(planning, made));
    expect(cleared.view.picks.units.size).toBe(0);
    expect(cleared.picks.support.size).toBe(0);
  });

  it("works on one group, leaving the others and the aircraft", () => {
    const planning = session();
    const made = press(planning, choices({}), madrid);
    const { picks, view } = paneOf(planning, made);
    expect(cards(view).filter((card) => view.picks.units.has(card.unitId)).every((card) => card.from === madrid)).toBe(true);
    expect(picks.support.size).toBe(0);
    expect(paneOf(planning, press(planning, made, madrid)).view.picks.units.size).toBe(0);
  });

  it("fills the trains with the strongest", () => {
    const crowded = session(stations(raised(footType, 1), 2));
    const { picks, view } = paneOf(crowded, choices({}), "reinforce", valencia);
    const chosen = selectAll(scenario, crowded.game.state, republic, view, picks, { orders: [] }, madrid);
    const fighting = cards(view).filter((card) => card.from === madrid && !card.general);
    const riding = fighting.filter((card) => chosen.ticks[card.unitId] === true);
    const left = fighting.filter((card) => chosen.ticks[card.unitId] !== true);
    expect([riding.length, left.length]).toEqual([4, 1]);
    expect(Math.min(...riding.map((card) => card.strength))).toBeGreaterThanOrEqual(Math.max(...left.map((card) => card.strength)));
  });
});

describe("N3: one planned move, one estimate", () => {
  it("shows the same odds on the map, in This turn and in the pane, however the order is given", () => {
    const state = withGeneral();
    const choosing = session(state, { selectedTerritoryId: madrid, selectedUnitIds: [wadRas, generalId], stage: { orderKind: "move", step: "choose-destination" } });
    const chip = selectedEstimates(scenario, choosing, [castile]).get(castile);
    const moved = clickTerritory(scenario, choosing, castile);
    const planned = plannedEstimates(scenario, state, republic, moved.draft.orders.filter(isMoveOrder)).get(castile);
    const { view } = paneOf(session(state), choices({ [generalId]: true, [wadRas]: true }));
    const order = musterOrderFrom(view, view.picks);
    const odds = invadeOdds(scenario, state, republic, castile, order.moves, [], { orders: [] });
    if (chip?.kind !== "battle" || planned?.kind !== "battle" || odds.kind !== "battle") throw new Error("battle");
    expect(planned).toEqual(chip);
    expect(oddsSummary(chip).chip).toBe(`${odds.odds} · ${odds.take}`);
    const given = orderMuster(scenario, session(state), order).draft.orders;
    expect(new Set(given.map((each) => JSON.stringify(each)))).toEqual(new Set(moved.draft.orders.map((each) => JSON.stringify(each))));
  });

  it("refuses a Move the reveal would hold back, as the pane does", () => {
    const planning = session(withGeneral(), { selectedTerritoryId: madrid, selectedUnitIds: [generalId], stage: { orderKind: "move", step: "choose-destination" } });
    expect(chooseDestination(scenario, planning, castile).draft.orders).toEqual([]);
    const alone = { kind: "invade", moves: [{ unitId: generalId }], shown: [], support: [], target: castile } as const;
    expect(musterRefusal(scenario, session(withGeneral()), alone)).toBe("It can't go alone: tick a unit in Madrid that can fight and goes the same way.");
  });

  it("has words for every reason an army is held back", () => {
    const words = (cause: HeldBackCause): string => heldBackRefusal(scenario, cause, madrid, castile);
    expect(words({ reason: "allowance" })).toContain("further than these units can move");
    expect(words({ reason: "port-landings" })).toContain("no room for another landing");
    expect(words({ reason: "amphibious-lane" })).toContain("already carries a landing");
    expect(words({ rail: { boarding: capitalOf(scenario, madrid) as SubTerritoryId, left: 0, places: 1 }, reason: "rail-full" })).toContain("no places left");
  });

  it("judges armies only under the allowance rules, and leaves a fitted view alone when nothing is ticked", () => {
    expect(judgePlannedMoves({ ...scenario, rules: { ...scenario.rules, movement: "single-step" } }, start, [move("republic", "rep-wad-ras-1", "madrid", "castilla-y-leon")])).toEqual([]);
    const { picks, view } = paneOf(session(), choices({}));
    expect(fitMuster(scenario, start, republic, view, picks, { orders: [] }).picks.units.size).toBe(0);
  });
});
