import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initialGameState } from "../../main/engine/resolution";
import { zoneOf } from "../../main/engine/weather";
import type { AirMissionOrder, GameState, RaisedUnitDefinition, SubTerritoryId, UnitTypeId, WeatherId } from "../../main/engine/types";
import { AirLayer } from "../../main/map/layers/AirLayer";
import { compactMetrics, counterMetrics } from "../../main/map/CounterLayer";
import { layoutPieces, placeAircraft, withoutAircraft } from "../../main/map/pieceLayout";
import { intersects } from "../../main/map/placement";
import { BattleIconLayer } from "../../main/map/BattleIconLayer";
import { placeOddsPlaques, DestinationOddsLayer } from "../../main/map/DestinationOddsLayer";
import { staticMapView } from "../../main/map/view";
import type { ScenarioPackage } from "../../main/scenarios/loader";
import { aircraftCounterText, aircraftGroupText, aircraftTag, baseWeather } from "../../main/presentation/airPane";
import { AircraftHere, AirPane } from "../../main/screens/pane/AirPane";
import { ContestedChip } from "../../main/screens/pane/ContestedChip";
import { RecruitsAtChip } from "../../main/screens/pane/RecruitsAtChip";
import { tabCount } from "../../main/screens/pane/TerritoryTabs";
import type { PlanningSession } from "../../main/state/planning";
import { emptyDraft } from "../../main/state/session";
import { createAppStore } from "../../main/state/store";
import { faction, shippedRegistry, spain, spainId, spainWithAir, territory, testStore, unit } from "../support";

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
  it("shows the base, the base's weather and one mission a turn, with greyed missions the type cannot fly", () => {
    const state = weatherEverywhere(start, flying!.id);
    withStore(<AirPane scenario={scenario} session={session(state)} unitId={bomber} />);
    expect(screen.getByRole("heading", { name: "Breguet XIX Light Bombers" })).toBeVisible();
    expect(screen.getByText(/based at Madrid/u)).toBeVisible();
    expect(screen.getByText("1 mission a turn")).toBeVisible();
    expect(screen.getByTitle(flying!.name)).toBeVisible();
    expect(screen.getByRole("button", { name: "Patrol" })).toBeDisabled();
    expect(screen.getByText("Choose a mission, then its target on the map.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Stand down" })).toHaveAttribute("aria-pressed", "true");
    cleanup();
    const raiding = session(state);
    withStore(<AirPane scenario={scenario} session={{ ...raiding, draft: { ...raiding.draft, stage: { mission: "raid", step: "choose-target" } } }} unitId={bomber} />);
    // m14: sub-territory, not province.
    expect(screen.getByText(/A raid on one sub-territory rolls/u)).toBeVisible();
    expect(screen.getByRole("button", { name: "Stand down" })).toHaveAttribute("aria-pressed", "false");
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
    expect(screen.getByRole("button", { name: /Breguet XIX Light Bombers \u00b7 Raid/u })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /Breguet/u }));
    const { container: empty } = withStore(<AircraftHere aircraft={[]} scenario={scenario} session={session(start)} />);
    expect(empty).toBeEmptyDOMElement();
  });
});

/** A unit raised in play (R6), so a test can put a type the board does not start with where it needs one. */
function withRaised(state: GameState, id: string, factionId: string, type: string, territoryId: string): GameState {
  const definition: RaisedUnitDefinition = { factionId: faction(factionId), fullStrength: 300, id: unit(id), name: id, type: type as UnitTypeId };
  return {
    ...state,
    raised: { ...state.raised, [id]: definition },
    units: { ...state.units, [id]: { factionId: faction(factionId), fatigue: 0, id: unit(id), morale: { demoralized: false, quietTurns: 0 }, strength: 300, territoryId: territory(territoryId) } }
  };
}

describe("the air pane's targets and cards (U2, U3)", () => {
  const fighter = unit("rep-ni52-fighters");

  it("warns of anti-air at the target and of enemy fighters that can reach it", () => {
    const defended = withRaised(withRaised(start, "north-flak", "north", "anti-air-battery", "castilla-y-leon"), "north-fighters", "north", "fighter-squadron", "castilla-y-leon");
    withStore(<AirPane scenario={scenario} session={session(defended, [raid])} unitId={bomber} />);
    const card = screen.getByText(/^Raid Burgos/u).closest(".air-target-card") as HTMLElement;
    const castilla = scenario.index.territories.get(territory("castilla-y-leon"))!.name;
    expect(within(card).getByText(`Anti-air in ${castilla}`).nextElementSibling).toHaveTextContent("\u22123");
    expect(within(card).getByText("Enemy fighters in range").nextElementSibling).toHaveTextContent("may intercept");
  });

  it("gives a support mission a card with its range but no raid figures", () => {
    const support: AirMissionOrder = { ...raid, mission: { kind: "support", territoryId: territory("castilla-la-mancha") } };
    withStore(<AirPane scenario={scenario} session={session(start, [support])} unitId={bomber} />);
    expect(screen.getByRole("button", { name: "Ground Support" })).toHaveAttribute("aria-pressed", "true");
    const card = screen.getByText(/^Ground Support /u).closest(".air-target-card") as HTMLElement;
    expect(within(card).getByText("Range").nextElementSibling).toHaveTextContent(/^1 of 4$/u);
    expect(within(card).queryByText(/^Anti-air/u)).toBeNull();
    expect(screen.queryByRole("list", { name: "Raid chances before interception" })).toBeNull();
  });

  it("starts choosing the mission's target on the map, and shows the planner's feedback", async () => {
    const planning = session(start, [raid]);
    const store = createAppStore({ preloadedState: { game: { session: planning } }, registry: shippedRegistry() });
    const pane = (shown: PlanningSession) => <Provider store={store}><AirPane scenario={scenario} session={shown} unitId={bomber} /></Provider>;
    const { rerender } = render(pane({ ...planning, draft: { ...planning.draft, feedback: "The target is out of range." } }));
    expect(screen.getByRole("status")).toHaveTextContent("The target is out of range.");
    expect(screen.queryByRole("combobox")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Ground Support" }));
    const after = store.getState().game.session;
    if (after.phase !== "planning") throw new Error("Expected planning.");
    expect(after.draft).toMatchObject({ airOrders: [raid], stage: { mission: "support", step: "choose-target" } });
    rerender(pane(after));
    expect(screen.getByRole("button", { name: "Ground Support" })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector(".air-target-card")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Stand down" }));
    const stood = store.getState().game.session;
    expect(stood.phase === "planning" ? stood.draft : undefined).toMatchObject({ airOrders: [] });
  });

  it("says when nothing is in range: an aircraft without an airfield it holds cannot fly", async () => {
    const madridSubs = new Set((scenario.index.subTerritoriesByTerritory.get(territory("madrid")) ?? []).map((entry) => entry.id));
    const unpaved: GameState = {
      ...start,
      subTerritories: Object.fromEntries(Object.entries(start.subTerritories).map(([id, site]) => [id, madridSubs.has(id as SubTerritoryId) ? { ...site, buildings: [] } : site]))
    };
    const store = createAppStore({ preloadedState: { game: { session: session(unpaved) } }, registry: shippedRegistry() });
    render(<Provider store={store}><AirPane scenario={scenario} session={session(unpaved)} unitId={bomber} /></Provider>);
    await userEvent.click(screen.getByRole("button", { name: "Ground Support" }));
    const after = store.getState().game.session;
    expect(after.phase === "planning" ? after.draft.feedback : undefined).toBe("Nothing in range for this mission.");
  });

  it("lists the other aircraft at the base with their planned missions, and none for a lone flight", () => {
    withStore(<AirPane scenario={scenario} session={session(start, [raid])} unitId={fighter} />);
    const madrid = scenario.index.territories.get(territory("madrid"))!.name;
    const list = screen.getByRole("heading", { name: `Other aircraft at ${madrid}` }).nextElementSibling as HTMLElement;
    expect(list).toHaveTextContent("Breguet XIX Light Bombers \u00b7 Raid");
    cleanup();
    // The Catalan recon flight is alone at its field.
    withStore(<AirPane scenario={scenario} session={session(start)} unitId={unit("rep-catalan-recon")} />);
    expect(screen.queryByRole("heading", { name: /^Other aircraft/u })).toBeNull();
  });
});

describe("the air layer (B1, M3)", () => {
  it("tags squadrons by mission and leaves aircraft out of the army counters", () => {
    expect(aircraftTag(["raid"])).toBe("BOMB");
    expect(aircraftTag(["patrol"])).toBe("FTR");
    // A fighter that also flies Ground Support is still a fighter; a bomber that does is a bomber.
    expect(aircraftTag(["patrol", "support"])).toBe("FTR");
    expect(aircraftTag(["raid", "support"])).toBe("BOMB");
    expect(aircraftTag(["recon"])).toBe("RCN");
    const ground = withoutAircraft(scenario, start);
    expect(Object.keys(ground.units).length).toBeLessThan(Object.keys(start.units).length);
    const noAir = initialGameState(spain());
    expect(withoutAircraft(spain(), noAir)).toBe(noAir);
  });

  const pkg = { map: mapStub(), scenario } as unknown as ScenarioPackage;
  const toScreen = (point: { readonly x: number; readonly y: number }) => point;
  const atMadrid = { expandedTerritoryId: territory("madrid"), narrow: false };
  const idsOf = (layout: ReturnType<typeof placeAircraft>) => layout.placements.map(({ item }) => (item.kind === "army" ? item.unit.id : item.key));
  const positionOf = (layout: ReturnType<typeof placeAircraft>, id: string) => layout.placements.find(({ item }) => item.kind === "army" && item.unit.id === unit(id))!.position;

  it.each([
    ["overview", 1.3, counterMetrics.overview],
    ["operational", 1.5, counterMetrics.operational],
    ["detail", 2.5, counterMetrics.detail]
  ] as const)("uses the army counters' size at the %s zoom, side by side", (_, zoom, metrics) => {
    const layout = placeAircraft(pkg, start, toScreen, { narrow: false, zoom }, []);
    expect(layout.metrics).toEqual(metrics);
    expect(layout.placements.length).toBe(5);
    const [first, second] = [positionOf(layout, "rep-breguet-bombers"), positionOf(layout, "rep-ni52-fighters")];
    expect(second.x - first.x).toBe(metrics.width + metrics.gap);
    expect(second.y).toBe(first.y);
    const madrid = layout.rects.find((rect) => rect.x === first.x && rect.y === first.y)!;
    expect(madrid).toMatchObject({ height: metrics.height, width: 2 * metrics.width + metrics.gap });
  });

  it("groups a base's aircraft by zoom alone, except in the expanded territory", () => {
    const grouped = placeAircraft(pkg, start, toScreen, { narrow: false, zoom: 1 }, []);
    expect(grouped.metrics).toEqual(compactMetrics.overview);
    expect(idsOf(grouped)).toContain("group:madrid:republic");
    expect(idsOf(grouped)).toContain("north-leon-recon");
    expect(idsOf(placeAircraft(pkg, start, toScreen, { ...atMadrid, zoom: 1 }, []))).toEqual(expect.arrayContaining(["rep-breguet-bombers", "rep-ni52-fighters"]));
    // A phone's overview groups whatever the zoom; a wide map's does not from 125%.
    expect(idsOf(placeAircraft(pkg, start, toScreen, { narrow: true, zoom: 1.3 }, []))).toContain("group:madrid:republic");
    expect(idsOf(placeAircraft(pkg, start, toScreen, { narrow: true, zoom: 1.5 }, []))).toContain("rep-ni52-fighters");
  });

  it("moves clear of names and other blocks, gives up the armies' spots before a name's, and settles for the least covered", () => {
    const options = { narrow: false, zoom: 2.5 };
    const open = placeAircraft(pkg, start, toScreen, options, []);
    const blocked = placeAircraft(pkg, start, toScreen, options, open.rects);
    for (const rect of blocked.rects) expect([...open.rects, ...blocked.rects.filter((other) => other !== rect)].some((other) => intersects(rect, other))).toBe(false);
    // Armies everywhere: the aircraft still keep clear of names.
    const everywhere = { height: 20000, width: 20000, x: -10000, y: -10000 };
    expect(placeAircraft(pkg, start, toScreen, options, open.rects, [everywhere]).rects).toEqual(blocked.rects);
    // Names everywhere but a corner: every block still gets a place.
    expect(placeAircraft(pkg, start, toScreen, options, [everywhere]).rects).toHaveLength(open.rects.length);
  });

  it("never lays an aircraft over an army on the Spanish map, at any zoom", () => {
    const spainPackage = shippedRegistry().require(spainId);
    for (const [zoom, scale] of [[1, 0.8], [1.3, 1.05], [1.5, 1.2], [1.8, 1.45], [2.1, 1.7], [3, 2.4]] as const) {
      const scaled = (point: { readonly x: number; readonly y: number }) => ({ x: point.x * scale, y: point.y * scale });
      for (const narrow of [false, true]) {
        const { air, armies, armyRects, groundGame } = layoutPieces(spainPackage, initialGameState(spainPackage.scenario), scaled, { narrow, zoom }, []);
        expect(air.rects.length).toBeGreaterThan(3);
        expect(Object.keys(groundGame.units)).not.toContain("rep-ni52-fighters");
        expect(armyRects).toHaveLength(armies.items.length);
        expect(air.rects.filter((rect) => armyRects.some((army) => intersects(rect, army)))).toEqual([]);
        expect(air.rects.filter((rect) => air.rects.some((other) => other !== rect && intersects(rect, other)))).toEqual([]);
      }
    }
  });

  it("moves the armies aside where no spot is left for the aircraft", () => {
    const spainPackage = shippedRegistry().require(spainId);
    // Every point of the map on one spot: the armies' stacks take all the room around it.
    const heap = () => ({ x: 0, y: 0 });
    const alone = layoutPieces(spainPackage, withoutAircraft(scenario, start), heap, { narrow: false, zoom: 2.5 }, []);
    const { air, armies } = layoutPieces(spainPackage, start, heap, { narrow: false, zoom: 2.5 }, []);
    expect(air.rects.length).toBeGreaterThan(3);
    expect(alone.air.rects).toEqual([]);
    expect(armies.positions).not.toEqual(alone.armies.positions);
  });

  it("draws an aircraft on an army's card: values, role, men, planned badge and ring, and selects on click", async () => {
    const layout = placeAircraft(pkg, start, toScreen, { ...atMadrid, zoom: 1 }, []);
    const onSelectUnit = vi.fn();
    const view = { ...staticMapView, onSelectUnit, plannedAirMissions: [raid], selectedAircraftId: bomber };
    const { container } = render(<AirLayer game={start} layout={layout} level="overview" scenarioPackage={pkg} toScreen={toScreen} unitSymbols={new Map([["bomber-squadron", "<svg></svg>"]])} view={view} />);
    const counter = screen.getByRole("button", { name: /Breguet XIX Light Bombers, .*attack 0, defence 1, .*raid mission planned/u });
    expect(counter).toHaveClass("unit-counter", "air-counter");
    expect(counter).toHaveAttribute("data-selected", "true");
    expect(counter).toHaveAttribute("data-ordered", "true");
    expect(counter).toHaveAttribute("data-grounded", "false");
    expect(counter.querySelector(".unit-counter-current")?.textContent).toBe("0-1");
    expect(counter.querySelector(".unit-counter-designation")?.textContent).toBe("BOMB");
    expect(counter.querySelector(".unit-counter-badge")).not.toBeNull();
    expect(counter.querySelector(".unit-counter-grounded")).toBeNull();
    expect(container.querySelector(".counter-layer.air-layer")).toHaveAttribute("data-level", "overview");
    expect(container.querySelector(".air-range-ring")).not.toBeNull();
    expect(container.querySelector(".air-mission-line[data-mission=\"raid\"]")).not.toBeNull();
    await userEvent.click(counter);
    expect(onSelectUnit).toHaveBeenCalledWith(expect.objectContaining({ id: bomber }));
    cleanup();
    const empty = { ...layout, placements: [] };
    const { container: none } = render(<AirLayer game={start} layout={empty} level="overview" scenarioPackage={pkg} toScreen={toScreen} unitSymbols={new Map()} view={staticMapView} />);
    expect(none).toBeEmptyDOMElement();
  });

  it("draws a base's aircraft as one card that opens the territory, with mission lines from it, hatched when grounded", async () => {
    const state = weatherEverywhere(start, grounding!.id);
    const layout = placeAircraft(pkg, state, toScreen, { narrow: false, zoom: 1 }, []);
    const onSelectTerritory = vi.fn();
    const view = { ...staticMapView, onSelectTerritory, plannedAirMissions: [raid] };
    const { container } = render(<AirLayer game={state} layout={layout} level="overview" scenarioPackage={pkg} toScreen={toScreen} unitSymbols={new Map()} view={view} />);
    const group = screen.getByRole("button", { name: /, 2 aircraft in Madrid, combined attack 0, defence 2, .*1 raid planned, grounded by/u });
    expect(group).toHaveClass("unit-counter-group", "air-counter");
    expect(group).toHaveAttribute("data-grounded", "true");
    expect(group).toHaveAttribute("data-ordered", "false");
    expect(group.querySelector(".unit-counter-count")?.textContent).toBe("\u00d72");
    expect(group.querySelector(".unit-counter-grounded svg")).not.toBeNull();
    const line = container.querySelector(".air-mission-line");
    expect(Number(line?.getAttribute("x1"))).toBeCloseTo(Number.parseFloat(group.style.left) + compactMetrics.overview.width / 2);
    await userEvent.click(group);
    expect(onSelectTerritory).toHaveBeenCalledWith(territory("madrid"));
    const recon = screen.getByRole("button", { name: /^Leon Reconnaissance Flight, .*, grounded by/u });
    expect(recon.querySelector(".unit-counter-grounded")).not.toBeNull();
    cleanup();
    render(<AirLayer game={state} layout={layout} level="overview" scenarioPackage={pkg} toScreen={toScreen} unitSymbols={new Map()} view={staticMapView} />);
    expect(screen.getByRole("button", { name: /2 aircraft in Madrid/u })).toHaveAttribute("tabindex", "-1");
  });

  it("leaves the counters out of the tab order and unpressed on a map that cannot select", () => {
    const layout = placeAircraft(pkg, start, toScreen, { narrow: false, zoom: 2.5 }, []);
    // A mission of an aircraft that is not on the map draws no line.
    const gone: AirMissionOrder = { ...raid, unitId: unit("gone") };
    const { container } = render(<AirLayer game={start} layout={layout} level="detail" scenarioPackage={pkg} toScreen={toScreen} unitSymbols={new Map()} view={{ ...staticMapView, plannedAirMissions: [gone], selectedAircraftId: unit("gone") }} />);
    const counter = screen.getByRole("button", { name: /^Breguet XIX Light Bombers, /u });
    expect(counter).toHaveAttribute("tabindex", "-1");
    expect(counter).not.toHaveAttribute("aria-pressed");
    expect(counter).toHaveAttribute("data-ordered", "false");
    expect(container.querySelector(".air-mission-line")).toBeNull();
    expect(container.querySelector(".air-range-ring")).toBeNull();
  });

  it("names a card's aircraft, type, faction, figures and mission, in its faction's colour, and never its base's works", () => {
    const type = scenario.index.unitTypes.get(scenario.index.units.get(bomber)!.type)!;
    const fortified: GameState = { ...start, fortification: { ...start.fortification, [territory("madrid")]: { factionId: republic, level: 2 } } };
    const card = aircraftCounterText(scenario, fortified, fortified.units[bomber]!, [raid]);
    expect(card).toMatchObject({
      color: scenario.index.factions.get(republic)!.color,
      grounded: false,
      label: `Breguet XIX Light Bombers, ${type.name}, ${scenario.index.factions.get(republic)!.name}, attack 0, defence 1, 100 of 100 men, raid mission planned`,
      name: "Breguet XIX Light Bombers",
      planned: raid,
      symbolKey: `republic:${type.id}`,
      tag: "BOMB"
    });
    expect(card.figures.dugIn).toBeUndefined();
    expect(aircraftCounterText(scenario, start, start.units[bomber]!, undefined).label).not.toMatch(/planned/u);
    expect(scenario.index.units.get(bomber)!.designation).toBe("BR19");
  });

  it("sums a group's figures and counts its missions, planned when every aircraft has one", () => {
    const pair = [start.units[bomber]!, start.units[unit("rep-ni52-fighters")]!];
    const patrol: AirMissionOrder = { factionId: republic, kind: "air-mission", mission: { kind: "patrol", territoryId: territory("madrid") }, unitId: unit("rep-ni52-fighters") };
    const group = aircraftGroupText(scenario, start, pair, [raid, patrol]);
    expect(group).toMatchObject({ grounded: false, ordered: true });
    expect(group.figures).toMatchObject({ attack: 0, count: 2, defence: 2 });
    expect(group.label).toMatch(/2 aircraft in Madrid.*, 1 patrol planned, 1 raid planned$/u);
    expect(aircraftGroupText(scenario, start, pair, undefined)).toMatchObject({ ordered: false });
    expect(() => aircraftGroupText(scenario, start, [], undefined)).toThrow("at least one");
  });

  it("grounds an aircraft by the turn's own rule: bad weather at a base without a paved airfield", () => {
    const aircraft = start.units[bomber]!;
    expect(baseWeather(scenario, weatherEverywhere(start, flying!.id), aircraft)).toMatchObject({ grounded: false, verdict: "flies" });
    expect(baseWeather(scenario, weatherEverywhere(start, grounding!.id), aircraft)).toMatchObject({ grounded: true, verdict: `grounded (${grounding!.name})` });
    const clearSkies = { ...scenario, modules: scenario.modules.filter((module) => module.area !== "weather") };
    delete (clearSkies as { weather?: unknown }).weather;
    expect(baseWeather(clearSkies, start, aircraft)).toBeUndefined();
  });
});

describe("battle icons on the resolution map (B5, D8)", () => {
  const marks = [{ at: { x: 10, y: 20 }, key: "a|b", territoryId: territory("andalucia"), title: "Defender routed" }];
  const toScreen = (point: { readonly x: number; readonly y: number }) => point;

  it("names the result in a tooltip and opens the territory's card on a click", async () => {
    const onSelectTerritory = vi.fn();
    render(<BattleIconLayer marks={marks} onSelectTerritory={onSelectTerritory} scenario={scenario} toScreen={toScreen} />);
    const button = screen.getByRole("button", { name: "Battle for Andaluc\u00eda: Defender routed" });
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
    expect(wide.textContent).toMatch(/By rail \u00b7 /u);
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
    expect(screen.getByText(/^Contested \u00b7 you hold \d+ of \d+$/u)).toBeVisible();
    expect(screen.getByText("Builds paused")).toHaveAttribute("data-tone", "paused");
    expect(screen.getByText("No recruiting")).toHaveAttribute("data-tone", "paused");
    cleanup();
    const { container } = render(<ContestedChip {...at("catalunya")} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("counts the viewer's units and queued sub-territories for the tabs (M6)", () => {
    const props = at("catalunya");
    expect(tabCount("units", props)).toBeGreaterThan(0);
    expect(tabCount("buildings", props)).toBe(0);
    expect(tabCount("recruit", props)).toBe(0);
    expect(tabCount("production", props)).toBeUndefined();
    const site = (ground.index.subTerritoriesByTerritory.get(territory("catalunya")) ?? [])[0]!;
    const planned = { ...props, session: { ...props.session, draft: { ...emptyDraft, builds: [{ factionId: republic, kind: "build" as const, project: { developmentId: "farms", kind: "development" } as never, subTerritoryId: site.id }] } } };
    expect(tabCount("buildings", planned)).toBe(1);
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
