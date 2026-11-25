import { describe, expect, it } from "vitest";
import { unitKindIn } from "../../main/engine/air/pieces";
import { requireUnitState } from "../../main/engine/lookup";
import type { MoveRoute } from "../../main/engine/movement/routes";
import { initialGameState } from "../../main/engine/resolution";
import type { AirMission, BuildingId, GameState, MoveOrder, Scenario, SubTerritoryId, TurnOutcome, WeatherRolledOutcome } from "../../main/engine/types";
import { aircraftView, antiAirHeading, flightRange, generalView, missionOver, sameMission } from "../../main/presentation/airPane";
import { weatherRules } from "../../main/engine/weather";
import { amountHeld, yieldCell } from "../../main/presentation/economy";
import { buildsPaused, contestedShare, hasSubTerritories, recruitingAt, subTerritoriesIn, subTerritoryEntries, territoryIncome } from "../../main/presentation/holdings";
import { kindsOnBoard } from "../../main/presentation/mapLayers";
import { holdCount } from "../../main/presentation/outcomes";
import { plannedRides, railLines, rideableStations, ridesFor, routeStops, selectedArmy } from "../../main/presentation/railLayer";
import { selectionReach } from "../../main/presentation/reachNote";
import { recruitTab } from "../../main/presentation/recruitTab";
import { recruitSlotsText } from "../../main/presentation/queues";
import { buildOptions, siteCard } from "../../main/presentation/siteCard";
import { rolledWeather, weatherAt, zoneForecast } from "../../main/presentation/weather";
import { faction, shippedRegistry, spainId, territory, unit } from "../support";

const scenario = shippedRegistry().require(spainId).scenario;
const start = initialGameState(scenario);
const republic = faction("republic");
const north = faction("north");
const madrid = territory("madrid");
const sub = (id: string) => id as SubTerritoryId;
const madridUnits = [unit("rep-wad-ras-1"), unit("rep-covadonga-4")];
const march: MoveOrder = { factionId: republic, from: madrid, kind: "move", to: territory("toledo"), unitId: madridUnits[0]! };

/** Madrid with one sub-territory beside its capital taken by the north. */
const contested: GameState = (() => {
  const taken = subTerritoriesIn(scenario, madrid).find(({ id }) => id !== scenario.index.territories.get(madrid)?.capitalSubTerritoryId)!;
  return { ...start, subTerritories: { ...start.subTerritories, [taken.id]: { ...start.subTerritories[taken.id]!, holder: north } } };
})();
const without = (rules: Partial<Scenario["rules"]>): Scenario => ({ ...scenario, rules: { ...scenario.rules, ...rules } });
const unitOf = (kind: string) => Object.values(start.units).find((entry) => unitKindIn(scenario, start.raised, entry.id) === kind)!;

describe("holdings", () => {
  it("lists a territory's sub-territories and marks its capital", () => {
    expect(hasSubTerritories(scenario)).toBe(true);
    const entries = subTerritoryEntries(scenario, madrid);
    expect(entries.map((entry) => entry.sub)).toEqual(subTerritoriesIn(scenario, madrid));
    expect(entries.filter((entry) => entry.capital).map((entry) => entry.sub.id)).toEqual([scenario.index.territories.get(madrid)?.capitalSubTerritoryId]);
    expect(subTerritoryEntries({ ...scenario, rules: { ...scenario.rules, territories: "whole" } as never }, territory("nowhere"))).toEqual([]);
  });

  it("says who holds contested ground, and that it pays and recruits nothing", () => {
    const total = subTerritoriesIn(scenario, madrid).length;
    expect(contestedShare(scenario, start, madrid, republic)).toBeUndefined();
    expect(contestedShare(scenario, contested, madrid, republic)).toEqual({ own: total - 1, total });
    expect(buildsPaused(scenario, start, madrid)).toBe(false);
    expect(buildsPaused(scenario, contested, madrid)).toBe(true);
    expect(recruitingAt(scenario, contested, madrid, republic)).toBe("paused");
    expect(territoryIncome(scenario, contested, madrid, republic)).toEqual({ own: false, paused: true, text: "No income" });
  });

  it("says where a holder recruits", () => {
    expect(recruitingAt(scenario, start, madrid, republic)).toEqual({ place: "Madrid" });
    expect(recruitingAt(scenario, start, madrid, north)).toBeUndefined();
    expect(recruitingAt(without({ recruitment: "none" }), start, madrid, republic)).toBeUndefined();
  });

  it("says what a territory pays, and to whom", () => {
    expect(territoryIncome(scenario, start, madrid, republic)).toMatchObject({ own: true, text: expect.stringMatching(/^Pays .+ a turn$/) });
    expect(territoryIncome(scenario, start, madrid, north)).toMatchObject({ own: false, text: expect.stringMatching(/ a turn to /) });
    expect(territoryIncome(scenario, { subTerritories: start.subTerritories }, territory("nowhere"), republic)).toBeUndefined();
    expect(territoryIncome(without({ economy: "none" }), start, madrid, republic)).toBeUndefined();
    const bare = Object.fromEntries(Object.entries(start.subTerritories).map(([id, site]) => [id, { ...site, buildings: [], development: {}, port: 0, rail: 0 }])) as GameState["subTerritories"];
    expect(territoryIncome(scenario, { subTerritories: bare }, madrid, republic)?.text).toBe("Pays nothing");
  });
});

describe("the site card", () => {
  it("shows the viewer's own sub-territory", () => {
    const card = siteCard(scenario, start, sub("madrid"), republic, [])!;
    expect(card).toMatchObject({ capital: true, contested: false, holder: undefined, name: "Madrid", own: true, queueNote: undefined });
    expect(card.cities).toContain("Madrid");
    expect(card.buildings.map(({ id }) => id)).toEqual(start.subTerritories[sub("madrid")]?.buildings);
    expect(card.rail?.level).toBe(card.railLevel);
  });

  it("hides another faction's queue, and names its holder", () => {
    expect(siteCard(scenario, start, sub("madrid"), north, [])).toMatchObject({ holder: expect.stringMatching(/^Held by /), own: false, queueNote: "Queue hidden" });
  });

  it("has nothing for an unknown sub-territory, and refuses an unknown building or city", () => {
    expect(siteCard(scenario, start, sub("nowhere"), republic, [])).toBeUndefined();
    const site = start.subTerritories[sub("madrid")]!;
    expect(() => siteCard(scenario, { ...start, subTerritories: { ...start.subTerritories, [sub("madrid")]: { ...site, buildings: ["mystery" as BuildingId] } } }, sub("madrid"), republic, [])).toThrow("mystery");
    expect(() => siteCard({ ...scenario, index: { ...scenario.index, cities: new Map() } }, start, sub("madrid"), republic, [])).toThrow("Unknown city");
  });

  it("offers the holder the projects, those that can be queued first", () => {
    const options = buildOptions(scenario, start, sub("madrid"), republic)!;
    const locked = options.map(({ refusal }) => refusal !== undefined);
    expect(locked).toEqual([...locked].sort((a, b) => Number(a) - Number(b)));
    expect(options[0]).toMatchObject({ order: { factionId: republic, kind: "build", subTerritoryId: "madrid" }, terms: expect.any(String) });
    expect(buildOptions(scenario, start, sub("madrid"), north)).toBeUndefined();
    expect(buildOptions(scenario, start, sub("nowhere"), republic)).toBeUndefined();
  });
});

describe("the Recruit tab", () => {
  it("parts the types the viewer can recruit from the locked ones, and counts the slots", () => {
    const view = recruitTab(scenario, start, madrid, republic, {});
    expect(view).toMatchObject({ capitalName: "Madrid", paused: false, siteNote: undefined, training: [] });
    expect(view.open.length).toBeGreaterThan(0);
    expect(view.open.every(({ locked, shortfall }) => locked.length === 0 && shortfall !== "")).toBe(true);
    expect(view.locked.every(({ locked }) => locked.length > 0)).toBe(true);
    expect(recruitSlotsText(scenario, start, madrid)).toBe(`${String(view.slots)} Recruit order${view.slots === 1 ? "" : "s"} a turn`);
  });

  it("locks every type where the site refuses them all", () => {
    const view = recruitTab(scenario, start, madrid, north, {});
    expect(view.open).toEqual([]);
    expect(view.locked.every(({ locked }) => locked[0] === view.siteNote)).toBe(true);
  });
});

describe("the rail layer", () => {
  it("finds the army that stands together, and the stations it rides to", () => {
    const army = selectedArmy(start, madridUnits);
    expect(army).toEqual({ factionId: republic, from: madrid });
    const apart = Object.values(start.units).find((entry) => entry.territoryId !== madrid)!;
    expect(selectedArmy(start, [...madridUnits, apart.id])).toBeUndefined();
    expect(selectedArmy(start, [])).toBeUndefined();
    expect(railLines(scenario, start).length).toBeGreaterThan(0);
    expect(rideableStations(scenario, start, army).size).toBeGreaterThan(0);
    expect(rideableStations(scenario, start, undefined).size).toBe(0);
    expect(ridesFor(scenario, start, army!, madridUnits, []).every(({ shape }) => shape !== "step" && shape !== "march")).toBe(true);
  });

  it("traces no planned march, nor any move without allowances", () => {
    expect(plannedRides(scenario, start, [march, march])).toEqual([]);
    expect(plannedRides(without({ movement: "adjacent" }), start, [march])).toEqual([]);
  });

  it("stops at capitals, stations and ports", () => {
    const capital = scenario.index.territories.get(madrid)!.capitalSubTerritoryId!;
    const route = (legs: readonly unknown[], rest: object) => ({ from: madrid, legs, to: madrid, ...rest }) as unknown as MoveRoute;
    const home = { stations: [capital], territory: madrid };
    expect(routeStops(scenario, route([{ kind: "march", to: madrid }], {}))).toEqual([home, home]);
    expect(routeStops(scenario, route([{ kind: "rail", to: madrid }], { rail: { stations: [sub("a"), sub("b")] } }))).toEqual([home, { stations: ["a"] }, { stations: ["b"] }]);
    expect(routeStops(scenario, route([{ kind: "sea", to: madrid }], { sea: { departure: sub("a"), port: sub("b") } }))).toEqual([home, { stations: ["a"] }, { stations: ["b", capital], territory: madrid }]);
    expect(routeStops(scenario, route([{ kind: "sea", to: territory("nowhere") }], { sea: { departure: sub("a") } }))).toEqual([home, { stations: ["a"] }, { stations: ["a"], territory: "nowhere" }, { stations: [], territory: "nowhere" }]);
  });

  it("reaches from the moves among the planned orders", () => {
    const reach = selectionReach(scenario, start, republic, madridUnits, [march, { factionId: republic, kind: "hold", unitId: madridUnits[1]! } as never]);
    expect(reach.size).toBeGreaterThan(0);
  });
});

describe("aircraft and generals", () => {
  const raid = (id: string): AirMission => ({ kind: "raid", subTerritoryId: sub(id) });
  const recon = (id: string): AirMission => ({ kind: "recon", territoryId: territory(id) });

  it("tells missions apart by kind and target", () => {
    expect(sameMission(undefined, raid("madrid"))).toBe(false);
    expect(sameMission(raid("madrid"), { subTerritoryId: sub("madrid"), kind: "raid" })).toBe(true);
    expect(sameMission(raid("madrid"), raid("toledo"))).toBe(false);
    expect(sameMission(raid("madrid"), recon("madrid"))).toBe(false);
    expect(sameMission(recon("madrid"), { territoryId: madrid, kind: "recon" })).toBe(true);
    expect(sameMission(recon("madrid"), recon("toledo"))).toBe(false);
    expect(sameMission(recon("madrid"), { kind: "patrol", territoryId: madrid })).toBe(false);
  });

  it("names the territory a raid is flown over", () => {
    expect(missionOver(scenario, raid("madrid"))).toBe(madrid);
    expect(antiAirHeading(scenario, raid("madrid"), "Cuatro Vientos")).toBe("Anti-air in Madrid");
    expect(antiAirHeading(scenario, raid("nowhere"), "Cuatro Vientos")).toBe("Anti-air in Cuatro Vientos");
  });

  it("describes an aircraft, its range and its fellows", () => {
    const aircraft = unitOf("air");
    const view = aircraftView(scenario, start, aircraft);
    expect(view.missions.some(({ allowed }) => allowed)).toBe(true);
    expect(view.range).toBeGreaterThan(0);
    expect(view.others.every((other) => other.id !== aircraft.id && other.territoryId === aircraft.territoryId)).toBe(true);
    expect(flightRange(scenario, start, aircraft)).toContain(aircraft.territoryId);
    const infantry = requireUnitState(start, madridUnits[0]!);
    expect(flightRange(scenario, start, infantry)).toBeUndefined();
    expect(aircraftView(scenario, start, infantry).range).toBe(0);
  });

  it("gives a general his pill", () => {
    expect(generalView(scenario, start, unitOf("general").id)).toMatchObject({ canSack: true, text: expect.any(String) });
    expect(generalView(scenario, start, madridUnits[0]!)).toBeUndefined();
  });

  it("knows the kinds on the board, and counts only armies as holding", () => {
    expect(kindsOnBoard(scenario, start)).toEqual(new Set(["ground", "air", "general"]));
    const hold = (unitId?: string) => ({ kind: "no-move", unitId }) as unknown as TurnOutcome;
    expect(holdCount(scenario, { finalState: start, outcomes: [hold(madridUnits[0]), hold(unitOf("air").id), hold(), { kind: "bounced-move" } as never] })).toBe(1);
  });
});

describe("weather and amounts", () => {
  const { outcomes, zones } = weatherRules(scenario)!;
  const all = { ...start, weather: { ...start.weather, outcomes: Object.fromEntries(zones.map(({ id }) => [id, outcomes[0]!.id])) } } as GameState;
  const zone = scenario.territories.find(({ id }) => zoneForecast(scenario, all, id) !== undefined)!;

  it("forecasts a zone's two likeliest outcomes and names this turn's", () => {
    const next = zoneForecast(scenario, all, zone.id)!.next;
    expect(next.length).toBeGreaterThan(0);
    expect(next.length).toBeLessThanOrEqual(2);
    expect(next[0]?.text).toMatch(/ \d+%$/);
    expect(zoneForecast(scenario, { ...all, weather: undefined } as unknown as GameState, zone.id)).toBeUndefined();
    expect(weatherAt(scenario, all, zone.id)).toEqual(outcomes[0]);
    const rolled = { kind: "weather-rolled", weather: all.weather } as unknown as WeatherRolledOutcome;
    expect(rolledWeather(scenario, rolled)[0]).toEqual({ text: `${zones[0]!.name}: ${outcomes[0]!.name}`, weatherId: outcomes[0]!.id, zoneId: zones[0]!.id });
    expect(rolledWeather(scenario, { ...rolled, weather: { ...rolled.weather, outcomes: {} } })).toEqual([]);
  });

  it("shows one resource of an amount, and a dash for none", () => {
    const [resource] = scenario.resources;
    expect(amountHeld(scenario, {}, resource!.id)).toMatch(/^0/);
    expect(yieldCell(scenario, {}, resource!.id)).toBe("−");
    expect(yieldCell(scenario, { [resource!.id]: 2 }, resource!.id)).toMatch(/^\+2/);
  });
});

