import { describe, expect, it } from "vitest";
import { legalMoves, planMoves, withRoutes } from "../main/ai/orders/move";
import { unitRoutes } from "../main/ai/reach";
import { createTrains, strongestAboard } from "../main/ai/trains";
import { capitalOf, railCapacity, railPlaces } from "../main/engine/movement/network";
import { boardingRefusal, moveRoutes, plannedRoutes, railPlacesLeft, railShortageText, routeOffers, usageOf } from "../main/engine/movement/routes";
import { reachFor } from "../main/engine/network/reach";
import { seededRandom } from "../main/engine/random";
import { raisedUnitId } from "../main/engine/recruitment/rules";
import { initialGameState } from "../main/engine/resolution";
import type { GameState, MoveOrder, RaisedUnitDefinition, SubTerritoryId, SubTerritoryState, TerritoryId, UnitId, UnitState, UnitTypeId } from "../main/engine/types";
import { modeChips } from "../main/presentation/moveModes";
import { routeDetail } from "../main/presentation/movement";
import { muster } from "../main/presentation/muster";
import { reachNote } from "../main/presentation/reachNote";
import { destinationRoutes } from "../main/screens/movement/destinationRoutes";
import type { Draft } from "../main/state/session";
import { chooseDestination, musterOrderFrom, musterRefusal, orderMuster, type PlanningSession } from "../main/state/planning";
import { faction, play, spainWithAir, territory, unit } from "./support";

/** D5: a station's trains take a number of units a turn, and an army whole or not at all. */

const scenario = spainWithAir();
const opening = initialGameState(scenario);
const republic = faction("republic");
const madrid = territory("madrid");
const valencia = territory("valencia");
const station = (territoryId: TerritoryId): SubTerritoryId => capitalOf(scenario, territoryId) as SubTerritoryId;

function withStations(state: GameState, levels: Readonly<Record<string, number>>): GameState {
  const subTerritories: Record<string, SubTerritoryState> = { ...state.subTerritories };
  for (const [id, rail] of Object.entries(levels)) {
    const capital = station(territory(id));
    subTerritories[capital] = { ...(subTerritories[capital] as SubTerritoryState), buildings: [], rail };
  }
  return { ...state, subTerritories };
}

/** The ids of units of a type raised in play. */
function raisedIds(type: string, count: number): readonly UnitId[] {
  return Array.from({ length: count }, (_, index) => raisedUnitId(republic, type as UnitTypeId, index + 1));
}

/** Units of a type raised in play in Madrid. */
function withRaised(state: GameState, type: string, count: number): GameState {
  const template = state.units[unit("rep-wad-ras-1")] as UnitState;
  const raised: Record<string, RaisedUnitDefinition> = { ...state.raised };
  const units: Record<string, UnitState> = { ...state.units };
  for (const id of raisedIds(type, count)) {
    raised[id] = { factionId: republic, formationKind: "regiment", fullStrength: 900, historicalNote: "Raised for the test.", homeTerritoryId: madrid, id, name: `Raised ${id}`, type: type as UnitTypeId } as unknown as RaisedUnitDefinition;
    units[id] = { ...template, id };
  }
  return { ...state, raised, units };
}

// Two places at Madrid and two at the station a step away, so three units can't ride together.
const start = withStations(opening, { "castilla-la-mancha": 1, madrid: 1 });
const regiments = [unit("rep-wad-ras-1"), unit("rep-covadonga-4"), unit("rep-madrid-security")] as const;
const pair = regiments.slice(0, 2);
const lastOne = regiments[2];
const trucks = raisedIds("truck-column", 3);
const truck = trucks[0] as UnitId;
const trucked = withRaised(start, "truck-column", 3);
const crowded = withRaised(start, "infantry-regiment", 2);
// Every way to Valencia by rail boards at Madrid or a step away, and these fill both.
const near = (unitId: UnitId): MoveOrder => ({ factionId: republic, from: madrid, kind: "move", legs: [{ kind: "land", to: territory("castilla-la-mancha") }, { kind: "rail", to: valencia }], to: valencia, unitId });
const full = [...pair.map((id): MoveOrder => ({ factionId: republic, from: madrid, kind: "move", legs: [{ kind: "rail", to: valencia }], to: valencia, unitId: id })), ...raisedIds("infantry-regiment", 2).map(near)];
const ride = (unitId: UnitId, to: TerritoryId = valencia): MoveOrder => ({ factionId: republic, from: madrid, kind: "move", legs: [{ kind: "rail", to }], to, unitId });

function session(draft: Partial<Draft> = {}, state: GameState = start): PlanningSession {
  return { draft: { orders: [], selectedUnitIds: [], ...draft }, factionId: republic, game: { assignments: {}, history: [], locked: {}, scenarioId: scenario.id, seed: 1, state }, phase: "planning" };
}

describe("the trains' places", () => {
  it("counts two places a station level and two more for a rail yard", () => {
    expect(railCapacity(scenario, start, station(madrid))).toBe(2);
    expect(railCapacity(scenario, opening, station(madrid))).toBe(6);
  });

  it("gives every ground unit a place, trucks included, and generals and aircraft none", () => {
    expect(railPlaces(scenario, trucked, [...pair, truck])).toBe(3);
    expect(railPlaces(scenario, start, [unit("rep-general-miaja"), unit("rep-ni52-fighters")])).toBe(0);
  });

  it("adds up planned units, whatever armies they make, and never leaves fewer than none", () => {
    const usage = usageOf(plannedRoutes(scenario, start, regiments.map((id) => ride(id))));
    expect(usage.departures.get(station(madrid))).toBe(3);
    expect(railPlacesLeft(scenario, start, station(madrid), usage)).toBe(0);
  });

  it("names the places left", () => {
    expect(railShortageText(scenario, { boarding: station(madrid), left: 0, places: 2 })).toBe("Rail has no places left at Madrid this turn.");
    expect(railShortageText(scenario, { boarding: station(madrid), left: 1, places: 2 })).toBe("Rail has only 1 place left at Madrid this turn, and 2 units would board.");
    expect(railShortageText(scenario, { boarding: "nowhere" as SubTerritoryId, left: 2, places: 3 })).toBe("Rail has only 2 places left at the station this turn, and 3 units would board.");
  });

  it("refuses moves that don't board together beside the others planned", () => {
    expect(boardingRefusal(scenario, start, pair.map((id) => ride(id)), [])).toBeUndefined();
    expect(boardingRefusal(scenario, start, regiments.map((id) => ride(id)), [])).toContain("only 2 places left");
    expect(boardingRefusal(scenario, start, [ride(lastOne)], pair.map((id) => ride(id)))).toContain("no places left");
    const { legs, ...step } = ride(lastOne);
    expect(legs).toHaveLength(1);
    expect(boardingRefusal(scenario, start, [{ ...step, to: territory("castilla-la-mancha") }], pair.map((id) => ride(id)))).toBeUndefined();
  });

  it("refuses the whole army at the turn's start, with the places left", () => {
    const result = play(scenario, start, regiments.map((id) => ride(id)));
    expect(result.outcomes.filter((outcome) => outcome.kind === "move-held-back")).toMatchObject([{ rail: { boarding: station(madrid), left: 2, places: 3 }, reason: "rail-full", unitIds: regiments }]);
  });
});

describe("giving a rail order", () => {
  it("offers no ride to units that don't fit together, and says how many places are left", () => {
    expect(moveRoutes(scenario, start, republic, madrid, pair).get(valencia)?.mode).toBe("rail");
    const offers = routeOffers(scenario, start, republic, madrid, regiments, []);
    expect(offers.routes.has(valencia)).toBe(false);
    expect(offers.full.get(valencia)).toEqual({ boarding: station(madrid), left: 2, places: 3 });
    // A destination with another way there is not refused.
    expect([...offers.full.keys()].some((to) => offers.routes.has(to))).toBe(false);
    const note = reachNote(scenario, valencia, reachFor(scenario, start, republic, regiments).get(valencia));
    expect(note?.lines).toContainEqual({ mode: "rail", text: "Rail has only 2 places left at Madrid this turn, and 3 units would board." });
  });

  it("counts the orders already planned in the reasons", () => {
    const reach = (planned: readonly MoveOrder[]) => reachFor(scenario, crowded, republic, [lastOne], planned);
    const riding = [...reach([])].flatMap(([to, each]) => (each.ok && each.mode === "rail" ? [to] : []));
    expect(riding).toContain(valencia);
    const reached = reach(full);
    for (const to of riding) {
      expect(reached.get(to)).toMatchObject({ ok: false, reasons: expect.arrayContaining([expect.objectContaining({ code: "rail-full" })]) as unknown });
    }
  });

  it("refuses the chosen destination with the places left", () => {
    const choosing = session({ selectedTerritoryId: madrid, selectedUnitIds: regiments, stage: { orderKind: "move", step: "choose-destination" } });
    const refused = chooseDestination(scenario, choosing, valencia);
    expect(refused.draft.orders).toEqual([]);
    expect(refused.draft.feedback).toBe("Rail has only 2 places left at Madrid this turn, and 3 units would board.");
    const sent = chooseDestination(scenario, session({ ...choosing.draft, selectedUnitIds: pair }), valencia);
    expect(sent.draft.orders).toHaveLength(2);
  });

  it("shows the places the ride would use, the units aboard included", () => {
    const planned = [ride(lastOne)];
    const routes = destinationRoutes(scenario, session({ orders: planned, selectedTerritoryId: madrid, selectedUnitIds: [pair[0] as UnitId] }));
    const route = routes?.routes.get(valencia);
    if (routes === undefined || route === undefined) throw new Error("no ride offered");
    expect(routes.placesUsed(route)).toBe(2);
    expect(routeDetail(scenario, start, route, routes.placesUsed(route))).toContain("uses 2 of Madrid's 2 train places");
    const step = routes.routes.get(territory("castilla-la-mancha"));
    expect(step?.rail === undefined && step !== undefined ? routes.placesUsed(step) : undefined).toBe(0);
  });
});

describe("the Invade and Reinforce panes", () => {
  const picks = (ids: readonly UnitId[]) => ({ modes: new Map(), support: new Set<UnitId>(), units: new Set(ids) });
  const order = (ids: readonly UnitId[], given = session()) =>
    musterOrderFrom(muster(scenario, given.game.state, republic, valencia, "reinforce", { orders: given.draft.orders }), picks(ids));

  it("orders ticked units that fit, and refuses the whole order when they don't", () => {
    expect(musterRefusal(scenario, session(), order(pair))).toBeUndefined();
    const refused = orderMuster(scenario, session(), order(regiments));
    expect(refused.draft.orders).toEqual([]);
    expect(refused.draft.feedback).toBe("Rail has only 2 places left at Madrid this turn, and 3 units would board.");
  });

  it("still lists a unit once the rides to the same place are full, so one can replace another", () => {
    const ordered = orderMuster(scenario, session(), order(pair));
    expect(ordered.draft.orders).toHaveLength(2);
    const swapped = order([pair[0] as UnitId, lastOne], ordered);
    expect(swapped.moves.map((each) => each.unitId)).toEqual(expect.arrayContaining([pair[0], lastOne]));
    expect(orderMuster(scenario, ordered, swapped).draft.orders.map((each) => each.unitId).sort()).toEqual([pair[0] as UnitId, lastOne].sort());
    expect(musterRefusal(scenario, ordered, order(regiments, ordered))).toContain("only 2 places left");
  });

  it("takes the trains other orders fill off a card, and says why", () => {
    const offered = moveRoutes(scenario, opening, republic, madrid, [lastOne]).get(valencia);
    if (offered === undefined) throw new Error("no ride offered");
    const rail = (others: readonly MoveOrder[]) => modeChips(scenario, start, republic, lastOne, { ...offered, mode: "motor", shape: "march" }, others).find((chip) => chip.mode === "rail");
    expect(rail([])).toMatchObject({ ok: true });
    const blocked = modeChips(scenario, crowded, republic, lastOne, { ...offered, mode: "motor", shape: "march" }, full).find((chip) => chip.mode === "rail");
    expect(blocked).toEqual({ mode: "rail", ok: false, reason: "Rail has no places left at Madrid this turn." });
  });
});

describe("the computer player's trains", () => {
  it("sends the strongest units that fit of an army too big for its trains", () => {
    const all = [...regiments, unit("rep-madrid-sierra-column")].map((id) => start.units[id] as UnitState);
    const aboard = strongestAboard(scenario, start, all, 2);
    expect(aboard).toHaveLength(2);
    expect(strongestAboard(scenario, start, [...all].reverse(), 2)).toEqual(aboard);
    const routed = withRoutes(scenario, start, republic, all.map((each) => ride(each.id)));
    expect(routed.map((each) => each.unitId).sort()).toEqual([...aboard].sort());
    expect(play(scenario, start, routed).outcomes.some((outcome) => outcome.kind === "move-held-back")).toBe(false);
  });

  it("never lets trucks take a fighting unit's place", () => {
    const routed = withRoutes(scenario, trucked, republic, pair.map((id) => ride(id)));
    expect(routed.map((each) => each.unitId).sort()).toEqual([...pair].sort());
    // With a place to spare, one truck rides along.
    expect(withRoutes(scenario, trucked, republic, [ride(pair[0] as UnitId)]).map((each) => each.unitId)).toEqual([pair[0], truck]);
  });

  it("keeps the ride its transport would crowd off the train", () => {
    const one = trucked.units[pair[0] as UnitId] as UnitState;
    expect(moveRoutes(scenario, trucked, republic, madrid, [one.id, ...trucks]).get(valencia)?.mode).not.toBe("rail");
    expect(unitRoutes(scenario, trucked, one).get(valencia)?.shape).toBe("rail");
    expect(legalMoves(scenario, trucked, one).find((each) => each.to === valencia)?.legs).toEqual([{ kind: "rail", to: valencia }]);
  });

  it("counts places as its plan fills them, and keeps units that take no train", () => {
    const trains = createTrains(scenario, start);
    const all = [...regiments].map((id) => start.units[id] as UnitState);
    const [first, second] = all as [UnitState, UnitState];
    expect(trains.boarding(first, valencia)).toBe(station(madrid));
    expect(trains.fitting(all, valencia)).toHaveLength(2);
    trains.take(first, valencia);
    expect(trains.fitting([second], valencia)).toEqual([second]);
    trains.take(second, valencia);
    expect(trains.fitting(all.slice(2), valencia)).toEqual([]);
    const near = territory("castilla-la-mancha");
    trains.take(all[2] as UnitState, near);
    expect(trains.boarding(first, near)).toBeUndefined();
    expect(trains.fitting(all, near)).toEqual(all);
    // Single steps take no trains.
    const steps = createTrains({ ...scenario, rules: { ...scenario.rules, movement: "single-step" } }, start);
    expect(steps.boarding(first, valencia)).toBeUndefined();
  });

  it("still sends one army a port level and keeps the rest home (M5)", () => {
    const isles = territory("islas-baleares");
    const port = start.subTerritories["mallorca" as SubTerritoryId] as SubTerritoryState;
    const open: GameState = {
      ...start,
      control: { ...start.control, [isles]: { factionId: republic, kind: "controlled" } },
      subTerritories: { ...start.subTerritories, ["mallorca" as SubTerritoryId]: { ...port, holder: republic, port: 1 } },
      units: Object.fromEntries(Object.entries(start.units).filter(([, each]) => each.territoryId !== isles || each.factionId === republic))
    };
    const sailor = (from: string): MoveOrder => {
      const [one] = Object.values(open.units).filter((each) => each.territoryId === territory(from) && each.factionId === republic && railPlaces(scenario, open, [each.id]) === 1);
      return { factionId: republic, from: territory(from), kind: "move", legs: [{ kind: "sea", to: isles }], to: isles, unitId: (one as UnitState).id };
    };
    const sailing = withRoutes(scenario, open, republic, [sailor("valencia"), sailor("catalunya")]);
    expect(sailing.map((each) => each.from)).toEqual([valencia]);
  });

  it("plans no turn its trains refuse", () => {
    const tight = withStations(withRaised(opening, "infantry-regiment", 5), { madrid: 1 });
    const orders = planMoves({ factionId: republic, memory: {}, planned: [], random: seededRandom(3), scenario, state: tight });
    expect(boardingRefusal(scenario, tight, orders, [])).toBeUndefined();
    expect(play(scenario, tight, orders).outcomes.some((outcome) => outcome.kind === "move-held-back" && outcome.reason === "rail-full")).toBe(false);
  });
});
