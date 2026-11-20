import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initialGameState } from "../../main/engine/resolution";
import { zoneOf } from "../../main/engine/weather";
import type { AirMissionOrder, GameState, SubTerritoryId, WeatherId } from "../../main/engine/types";
import { aircraftTag, AirLayer, placeAircraft, withoutAircraft } from "../../main/map/layers/AirLayer";
import { BattleIconLayer } from "../../main/map/BattleIconLayer";
import { placeOddsPlaques, DestinationOddsLayer } from "../../main/map/DestinationOddsLayer";
import { staticMapView } from "../../main/map/view";
import type { ScenarioPackage } from "../../main/scenarios/loader";
import { AircraftHere, AirPane } from "../../main/screens/pane/AirPane";
import { ContestedChip } from "../../main/screens/pane/ContestedChip";
import { RecruitsAtChip } from "../../main/screens/pane/RecruitsAtChip";
import { tabCount } from "../../main/screens/pane/TerritoryTabs";
import type { PlanningSession } from "../../main/state/planning";
import { emptyDraft } from "../../main/state/session";
import { faction, spain, spainId, spainWithAir, territory, testStore, unit } from "../support";

afterEach(cleanup);

const scenario = spainWithAir();
const republic = faction("republic");
const bomber = unit("rep-breguet-bombers");
const sub = (id: string): SubTerritoryId => id as SubTerritoryId;

function session(state: GameState, airOrders: readonly AirMissionOrder[] = []): PlanningSession {
  return {
    draft: { ...emptyDraft, airOrders },
    factionId: republic,
    game: { assignments: {}, history: [], locked: {}, scenarioId: spainId, seed: 1, state },
    phase: "planning"
  };
}

function withStore(node: ReactNode) {
  return render(<Provider store={testStore()}>{node}</Provider>);
}

/** The board with every weather zone set to one outcome. */
function weatherEverywhere(state: GameState, id: WeatherId): GameState {
  const zones = scenario.weather?.zones ?? [];
  return { ...state, weather: { outcomes: Object.fromEntries(zones.map((zone) => [zone.id, id])), roll: 10 } };
}

const grounding = scenario.weather?.outcomes.find((outcome) => outcome.effects.some((effect) => effect.kind === "grounds-aircraft"));
const flying = scenario.weather?.outcomes.find((outcome) => !outcome.effects.some((effect) => effect.kind === "grounds-aircraft"));
const start = initialGameState(scenario);
const raid: AirMissionOrder = { factionId: republic, kind: "air-mission", mission: { kind: "raid", subTerritoryId: sub("burgos") }, unitId: bomber };

describe("the air pane (U2, M11, `ux-air-a`)", () => {
  it("shows the base, the base's weather and one mission a turn, with greyed missions the type cannot fly", async () => {
    const state = weatherEverywhere(start, flying!.id);
    withStore(<AirPane scenario={scenario} session={session(state)} unitId={bomber} />);
    expect(screen.getByRole("heading", { name: "Breguet XIX Light Bombers" })).toBeVisible();
    expect(screen.getByText(/based at Madrid/u)).toBeVisible();
    expect(screen.getByText("1 mission a turn")).toBeVisible();
    expect(screen.getByTitle(flying!.name)).toBeVisible();
    expect(screen.getByRole("button", { name: "Intercept" })).toBeDisabled();
    expect(screen.getByText("Choose a mission, then its target.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Raid" }));
    // m14: sub-territory, not province.
    expect(screen.getByText(/A raid on one sub-territory rolls/u)).toBeVisible();
    expect(screen.getByRole("combobox")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Stand down" }));
    expect(screen.getByRole("button", { name: "Stand down" })).toHaveAttribute("aria-pressed", "true");
  });

  it("fills the target card for a planned raid: range, base weather that flies, anti-air and keyed chances", () => {
    const state = weatherEverywhere(start, flying!.id);
    withStore(<AirPane scenario={scenario} session={session(state, [raid])} unitId={bomber} />);
    const card = screen.getByText(/^Raid Burgos/u).closest(".air-target-card") as HTMLElement;
    expect(within(card).getByText("Range")).toBeVisible();
    const zone = zoneOf(scenario, territory("madrid"))?.name ?? "";
    expect(within(card).getByText(new RegExp(`Weather \\u00b7 ${zone}`, "u"))).toBeVisible();
    expect(within(card).getByText("flies")).toBeVisible();
    const chances = within(card).getByRole("list", { name: "Raid chances before interception" });
    expect(chances.querySelectorAll(".air-chance-key")).toHaveLength(4);
    expect(screen.getByRole("heading", { name: /Other aircraft at Madrid/u })).toBeVisible();
  });

  it("says when the base's weather grounds the aircraft, and when a paved airfield lets it fly", () => {
    const muddy = weatherEverywhere(start, grounding!.id);
    const { unmount } = withStore(<AirPane scenario={scenario} session={session(muddy, [raid])} unitId={bomber} />);
    expect(screen.getByText(`grounded (${grounding!.name})`)).toHaveAttribute("data-grounded", "true");
    unmount();
    const paved = scenario.buildings.find((building) => building.effects.some((effect) => effect.kind === "all-weather-airbase"))!;
    const madridSubs = scenario.index.subTerritoriesByTerritory.get(territory("madrid")) ?? [];
    const site = madridSubs.find((entry) => muddy.subTerritories[entry.id]?.holder === republic)!;
    const withRunway: GameState = {
      ...muddy,
      subTerritories: { ...muddy.subTerritories, [site.id]: { ...muddy.subTerritories[site.id]!, buildings: [...muddy.subTerritories[site.id]!.buildings, paved.id] } }
    };
    withStore(<AirPane scenario={scenario} session={session(withRunway, [raid])} unitId={bomber} />);
    expect(screen.getByText("flies (paved airfield)")).toBeVisible();
  });

  it("renders nothing for a unit no longer on the board, and lists the aircraft in a territory", async () => {
    const { container } = withStore(<AirPane scenario={scenario} session={session(start)} unitId={unit("gone")} />);
    expect(container).toBeEmptyDOMElement();
    const aircraft = Object.values(start.units).filter((entry) => entry.territoryId === territory("madrid") && entry.factionId === republic && /bomber|fighter/u.test(entry.id));
    withStore(<AircraftHere aircraft={aircraft} scenario={scenario} session={session(start, [raid])} />);
    expect(screen.getByRole("heading", { name: "Aircraft here" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Breguet XIX Light Bombers · Raid/u })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /Breguet/u }));
    const { container: empty } = withStore(<AircraftHere aircraft={[]} scenario={scenario} session={session(start)} />);
    expect(empty).toBeEmptyDOMElement();
  });
});

describe("the air layer (B1, M3)", () => {
  it("tags squadrons by mission and leaves aircraft out of the army counters", () => {
    expect(aircraftTag(["raid"])).toBe("BOMB");
    expect(aircraftTag(["intercept"])).toBe("FTR");
    expect(aircraftTag(["recon"])).toBe("RCN");
    const ground = withoutAircraft(scenario, start);
    expect(Object.keys(ground.units).length).toBeLessThan(Object.keys(start.units).length);
    const noAir = initialGameState(spain());
    expect(withoutAircraft(spain(), noAir)).toBe(noAir);
  });

  it("places each airfield's squadrons as one row, clear of names when a spot allows, and returns their rectangles", () => {
    const pkg = { map: mapStub(), scenario } as unknown as ScenarioPackage;
    const toScreen = (point: { readonly x: number; readonly y: number }) => point;
    const open = placeAircraft(pkg, start, toScreen, []);
    expect(open.placements.length).toBeGreaterThan(0);
    expect(open.rects.length).toBeLessThanOrEqual(open.placements.length);
    // Block every first-choice spot: the rows move elsewhere and never overlap each other.
    const blocked = placeAircraft(pkg, start, toScreen, open.rects);
    expect(blocked.rects).not.toEqual(open.rects);
    const madrid = open.placements.filter((entry) => entry.unit.territoryId === territory("madrid") && entry.unit.factionId === republic);
    expect(madrid.length).toBeGreaterThan(1);
    expect(madrid[1]!.position.x - madrid[0]!.position.x).toBe(39);
    expect(madrid[1]!.position.y).toBe(madrid[0]!.position.y);
  });

  it("draws counters with names, a planned badge and the selected aircraft's ring, and selects on click", async () => {
    const pkg = { map: mapStub(), scenario } as unknown as ScenarioPackage;
    const toScreen = (point: { readonly x: number; readonly y: number }) => point;
    const { placements } = placeAircraft(pkg, start, toScreen, []);
    const onSelectUnit = vi.fn();
    const view = { ...staticMapView, onSelectUnit, plannedAirMissions: [raid], selectedAircraftId: bomber };
    const { container } = render(<AirLayer game={start} level="overview" placements={placements} scenarioPackage={pkg} toScreen={toScreen} unitSymbols={new Map()} view={view} />);
    const counter = screen.getByRole("button", { name: /Breguet XIX Light Bombers, .*raid mission planned/u });
    expect(counter).toHaveAttribute("data-selected", "true");
    expect(container.querySelector(".air-range-ring")).not.toBeNull();
    expect(container.querySelector(".air-mission-line[data-mission=\"raid\"]")).not.toBeNull();
    await userEvent.click(counter);
    expect(onSelectUnit).toHaveBeenCalledWith(expect.objectContaining({ id: bomber }));
    cleanup();
    const { container: none } = render(<AirLayer game={start} level="overview" placements={[]} scenarioPackage={pkg} toScreen={toScreen} unitSymbols={new Map()} view={staticMapView} />);
    expect(none).toBeEmptyDOMElement();
  });
});

describe("battle icons on the resolution map (B5, D8)", () => {
  const marks = [{ at: { x: 10, y: 20 }, key: "a|b", territoryId: territory("andalucia"), title: "Defender routed" }];
  const toScreen = (point: { readonly x: number; readonly y: number }) => point;

  it("names the result in a tooltip and opens the territory's card on a click", async () => {
    const onSelectTerritory = vi.fn();
    render(<BattleIconLayer marks={marks} onSelectTerritory={onSelectTerritory} scenario={scenario} toScreen={toScreen} />);
    const button = screen.getByRole("button", { name: "Battle for Andalucía: Defender routed" });
    expect(button).toHaveAccessibleDescription(/Defender routed.*Click to open its battle card/u);
    await userEvent.click(button);
    expect(onSelectTerritory).toHaveBeenCalledWith("andalucia");
    button.focus();
    fireEvent.keyDown(button, { key: "Escape" });
    expect(button).not.toHaveFocus();
    fireEvent.keyDown(button, { key: "Enter" });
  });

  it("is inert without a selection handler, and absent without battles", () => {
    render(<BattleIconLayer marks={marks} onSelectTerritory={undefined} scenario={scenario} toScreen={toScreen} />);
    expect(screen.getByRole("button")).toBeDisabled();
    cleanup();
    const { container: none } = render(<BattleIconLayer marks={[]} onSelectTerritory={undefined} scenario={scenario} toScreen={toScreen} />);
    expect(none).toBeEmptyDOMElement();
  });
});

describe("destination plaques on a phone (M8)", () => {
  it("keeps plaques inside the map, pulling one in from the edge", () => {
    const viewport = { height: 300, width: 200 };
    const spots = placeOddsPlaques([{ at: { x: 195, y: 100 }, territoryId: territory("valencia"), text: "Reinforce" }, { at: { x: 100, y: 150 }, territoryId: territory("madrid"), text: "1:1" }], [], viewport);
    for (const rect of spots.values()) {
      expect(rect.x).toBeGreaterThanOrEqual(6);
      expect(rect.x + rect.width).toBeLessThanOrEqual(194);
    }
    // Without a viewport, the first free spot is taken as it is.
    expect(placeOddsPlaques([{ at: { x: 195, y: 100 }, territoryId: territory("valencia"), text: "Reinforce" }], []).get(territory("valencia"))!.x).toBeGreaterThan(150);
  });

  it("shrinks a route's tag to its symbol on the phone", () => {
    const estimates = new Map([[territory("valencia"), { kind: "reinforcement" } as never], [territory("aragon"), { kind: "reinforcement" } as never], [territory("murcia"), { kind: "reinforcement" } as never]]);
    const tags = new Map([[territory("valencia"), "By rail"], [territory("aragon"), "By sea"], [territory("murcia"), "March 2"]]);
    const { container } = render(<DestinationOddsLayer compact counters={[]} estimates={estimates} labelAt={() => ({ x: 50, y: 50 })} tags={tags} viewport={{ height: 400, width: 400 }} />);
    expect(container.textContent).not.toMatch(/By rail|By sea|March/u);
    expect(container.querySelector(".site-icon[data-icon=\"rail\"]")).not.toBeNull();
    expect(container.querySelector(".site-icon[data-icon=\"port\"]")).not.toBeNull();
    cleanup();
    const { container: wide } = render(<DestinationOddsLayer counters={[]} estimates={estimates} labelAt={() => ({ x: 50, y: 50 })} tags={tags} />);
    expect(wide.textContent).toMatch(/By rail · /u);
  });
});

describe("the meta row's contested pills and Recruits-at chip (M5, M12)", () => {
  const ground = spain();
  const state = initialGameState(ground);
  const at = (territoryId: string) => ({ scenario: ground, session: session(state), territoryId: territory(territoryId) });

  it("says where a held territory recruits, and nothing for someone else's", () => {
    render(<RecruitsAtChip {...at("catalunya")} />);
    expect(screen.getByText("Recruits at Barcelona")).toBeVisible();
    cleanup();
    const { container } = render(<RecruitsAtChip {...at("galicia")} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("in contested ground: you hold n of m, builds paused, no recruiting", () => {
    render(<><ContestedChip {...at("andalucia")} /><RecruitsAtChip {...at("andalucia")} /></>);
    expect(screen.getByText(/^Contested · you hold \d+ of \d+$/u)).toBeVisible();
    expect(screen.getByText("Builds paused")).toHaveAttribute("data-tone", "paused");
    expect(screen.getByText("No recruiting")).toHaveAttribute("data-tone", "paused");
    cleanup();
    const { container } = render(<ContestedChip {...at("catalunya")} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("counts the viewer's units and queued sub-territories for the tabs (M6)", () => {
    const props = at("catalunya");
    expect(tabCount("units", props)).toBeGreaterThan(0);
    expect(tabCount("build", props)).toBe(0);
    expect(tabCount("recruit", props)).toBeUndefined();
    const site = (ground.index.subTerritoriesByTerritory.get(territory("catalunya")) ?? [])[0]!;
    const planned = { ...props, session: { ...props.session, draft: { ...emptyDraft, builds: [{ factionId: republic, kind: "build" as const, project: { developmentId: "farms", kind: "development" } as never, subTerritoryId: site.id }] } } };
    expect(tabCount("build", planned)).toBe(1);
  });
});

/** A map package stub: every territory's label and every city at a distinct point. */
function mapStub() {
  const territories = new Map(scenario.territories.map((entry, index) => [entry.id, { label: { tier: "overview", x: 100 + 60 * index, y: 300 }, shape: undefined }]));
  const cities = new Map(scenario.cities.map((entry, index) => [entry.id, { tier: "overview", x: 100 + 60 * index, y: 500 }]));
  return { cities, territories };
}

describe("the legend's Milestone 3 entries (m11, X8)", () => {
  it("lists rail, aircraft and generals where the board has them, each with its symbol", async () => {
    const { legendEntries, MapLegend } = await import("../../main/map/MapLegend");
    expect(legendEntries(scenario, start, staticMapView)).toEqual(expect.arrayContaining(["rail", "aircraft", "general"]));
    render(<MapLegend game={start} scenario={scenario} view={staticMapView} />);
    expect(screen.getByText(/^Aircraft at their airfield/u)).toBeInTheDocument();
    expect(screen.getByText(/^General with his units$/u)).toBeInTheDocument();
    expect(screen.getByText(/^Unit: attack-defence/u)).toBeInTheDocument();
  });
});
