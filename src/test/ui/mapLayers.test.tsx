import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../main/app";
import { initialGameState } from "../../main/engine/resolution";
import type { LinkDefinition, Scenario, SubTerritoryId, UnitId } from "../../main/engine/types";
import { RegistryContext } from "../../main/hooks";
import { CampaignMap } from "../../main/map/CampaignMap";
import {
  activePreset,
  autoLayers,
  defaultLayers,
  hiddenLayers,
  layerIds,
  layersControlObstacle,
  presetLayers,
  roadStyle,
  shownLayers,
  showsSubTerritoryBorders,
  toggleLayer
} from "../../main/map/layers/layerChoice";
import { LayersToolbar } from "../../main/map/layers/LayersToolbar";
import { RoadLayer } from "../../main/map/layers/RoadLayer";
import { passTitle, roadKinds, roadSegments } from "../../main/map/layers/roads";
import { legendEntries, MapLegend } from "../../main/map/MapLegend";
import { staticMapView } from "../../main/map/view";
import type { ScenarioPackage } from "../../main/scenarios/loader";
import { mapLayersChosen } from "../../main/state/mapLayersSlice";
import { paths } from "../../main/state/routing";
import { emptyDraft } from "../../main/state/session";
import { standingBattle } from "../battleFixtures";
import { faction, shippedRegistry, spainId, territory, testRegistry, testStore, unit } from "../support";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sub = (id: string): SubTerritoryId => id as SubTerritoryId;
const spainPackage = (): ScenarioPackage => testRegistry().require(spainId);
const units = (...ids: string[]): ReadonlySet<UnitId> => new Set(ids.map(unit));

/** The map without its sub-territories. */
function withoutSubTerritories(map: ScenarioPackage["map"]): ScenarioPackage["map"] {
  const bare = { ...map };
  delete (bare as { subTerritories?: unknown }).subTerritories;
  return bare;
}

describe("battle icons on the resolution map (B5)", () => {
  it("are kept clear by the counters, so a focused territory's fanned-out stack leaves its icon clickable", async () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1408);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(704);
    const pkg = shippedRegistry().require(spainId);
    const assets = await shippedRegistry().loadAssets(spainId);
    render(<CampaignMap
      assets={assets}
      game={initialGameState(pkg.scenario)}
      scenarioPackage={pkg}
      view={{ ...staticMapView, focusedTerritoryId: territory("asturias"), onSelectTerritory: vi.fn(), outcomes: [standingBattle] }}
    />);
    await screen.findByRole("application", { name: /map/ });
    const at = (element: HTMLElement): { readonly x: number; readonly y: number } => ({ x: Number.parseFloat(element.style.left), y: Number.parseFloat(element.style.top) });
    const icon = document.querySelector<HTMLElement>(".battle-icon");
    if (icon === null) throw new Error("no battle icon");
    const centre = at(icon);
    const counters = [...document.querySelectorAll<HTMLElement>(".unit-counter")];
    expect(counters.length).toBeGreaterThan(3);
    // The icon's button is 24 px across its centre.
    const covering = counters.filter((counter) => {
      const { x, y } = at(counter);
      return x < centre.x + 12 && centre.x - 12 < x + Number.parseFloat(counter.style.width) && y < centre.y + 12 && centre.y - 12 < y + Number.parseFloat(counter.style.height);
    });
    expect(covering.map((counter) => counter.title)).toEqual([]);
  });
});

describe("layer presets and switches (U13)", () => {
  it("opens on the Orders preset, the map as it was: rail, order lines and battles, no roads", () => {
    expect(defaultLayers).toEqual(["sub-territories", "rail", "order-lines", "battles"]);
    expect(activePreset(defaultLayers)).toBe("orders");
    expect(activePreset(presetLayers("logistics"))).toBe("logistics");
    expect(presetLayers("logistics")).toEqual(expect.arrayContaining(["rail", "roads"]));
    expect(presetLayers("logistics")).not.toContain("order-lines");
    expect(activePreset(presetLayers("economy"))).toBe("economy");
  });

  it("matches a preset only exactly, and toggles a layer keeping the menu's order", () => {
    expect(activePreset(["rail"])).toBeUndefined();
    expect(activePreset([...defaultLayers, "roads"])).toBeUndefined();
    const withRoads = toggleLayer(defaultLayers, "roads");
    expect(withRoads).toEqual(["sub-territories", "rail", "roads", "order-lines", "battles"]);
    expect(toggleLayer(withRoads, "roads")).toEqual(defaultLayers);
  });

  it("switches layers on by itself while an order is given, keeping the player's choice", () => {
    const idle = { ...staticMapView };
    expect(autoLayers(idle)).toEqual([]);
    expect(autoLayers({ ...idle, selectedUnitIds: units("a") })).toEqual(["rail"]);
    expect(autoLayers({ ...idle, destinationIds: [territory("madrid")], selectedUnitIds: units("a") })).toEqual(["rail", "roads", "order-lines"]);
    expect(autoLayers({ ...idle, selectedAircraftId: unit("plane") })).toEqual(["order-lines"]);
    // Destinations without a selection (a report's highlights) switch nothing on.
    expect(autoLayers({ ...idle, destinationIds: [territory("madrid")] })).toEqual([]);
    const economy = presetLayers("economy");
    expect(shownLayers(economy, { ...idle, destinationIds: [territory("madrid")], selectedUnitIds: units("a") })).toEqual(["sub-territories", "rail", "roads", "order-lines"]);
    expect(shownLayers(economy, idle)).toEqual(economy);
    expect(hiddenLayers(economy)).toBe("rail roads order-lines battles");
    expect(hiddenLayers(layerIds)).toBe("");
  });

  it("shows every sub-territory border past 250% zoom, with the Sub-territories layer on", () => {
    expect(showsSubTerritoryBorders(2.25, defaultLayers)).toBe(false);
    expect(showsSubTerritoryBorders(2.5, defaultLayers)).toBe(false);
    expect(showsSubTerritoryBorders(2.75, defaultLayers)).toBe(true);
    expect(showsSubTerritoryBorders(4, ["rail"])).toBe(false);
  });

  it("draws main roads heavier and solid, tracks faint and dashed", () => {
    const main = roadStyle("main");
    const track = roadStyle("track");
    expect(main.width).toBeGreaterThan(track.width);
    expect(main.opacity).toBeGreaterThan(track.opacity);
    expect(main.dash).toBeUndefined();
    expect(track.dash).toBeDefined();
  });

  it("keeps counters clear of the bar on desktop and of the button on a phone", () => {
    const side = layersControlObstacle("side", { height: 700, insetRight: 400, width: 1400 });
    expect(side.y + side.height).toBe(700);
    expect(side.x + side.width / 2).toBe(500);
    const sheet = layersControlObstacle("sheet", { height: 800, insetRight: 0, width: 400 });
    expect(sheet.y).toBe(0);
    expect(sheet.x + sheet.width).toBe(400);
  });
});

describe("roads and passes from the links (U8)", () => {
  it("joins the towns of linked sub-territories, naming passes", () => {
    const { map, scenario } = spainPackage();
    const segments = roadSegments(scenario, map);
    expect(segments.length).toBeGreaterThan(50);
    expect(segments.some((segment) => segment.level === "main")).toBe(true);
    expect(segments.some((segment) => segment.level === "track")).toBe(true);
    const passes = segments.flatMap((segment) => (segment.pass === undefined ? [] : [segment.pass]));
    expect(passes).toContain("Somosierra, mountain pass");
    expect(roadKinds(scenario)).toEqual({ main: true, pass: true, track: true });
  });

  it("leaves out links with neither road nor pass, or unplaced, and marks a pass without a road", () => {
    const { map, scenario } = spainPackage();
    const [first] = scenario.links;
    const bare: LinkDefinition = { ...first!, modifiers: [{ kind: "rail", level: "single" }] };
    const passOnly: LinkDefinition = { ...first!, modifiers: [{ kind: "pass", name: "Test" }] };
    const nowhere: LinkDefinition = { ...first!, a: sub("nowhere"), modifiers: [{ kind: "road", level: "main" }] };
    const withLinks = (links: readonly LinkDefinition[], extra: Partial<Scenario> = {}): Scenario => ({ ...scenario, ...extra, links });
    expect(roadSegments(withLinks([bare, nowhere]), map)).toEqual([]);
    expect(roadSegments(withLinks([passOnly], { linkModifiers: {} }), map)).toEqual([expect.objectContaining({ level: undefined, pass: "Test" })]);
    expect(roadSegments(scenario, withoutSubTerritories(map))).toEqual([]);
    expect(passTitle("Pajares", undefined)).toBe("Pajares");
    expect(roadKinds(withLinks([bare]))).toEqual({ main: false, pass: false, track: false });
  });

  it("draws roads as lines and each pass as a named chevron that keeps its click", async () => {
    const scenarioPackage = spainPackage();
    const onClick = vi.fn();
    const { container } = render(
      <svg onClick={onClick}>
        <RoadLayer scenarioPackage={scenarioPackage} toScreen={(point) => point} />
      </svg>
    );
    const lines = container.querySelectorAll(".road-line");
    expect(lines.length).toBeGreaterThan(50);
    expect(container.querySelector(".road-line[data-level='track']")).toHaveAttribute("stroke-dasharray", "3 3");
    expect(container.querySelector(".road-line[data-level='main']")).not.toHaveAttribute("stroke-dasharray");
    const pass = screen.getByRole("img", { name: "Somosierra, mountain pass" });
    expect(pass.querySelector("title")).toHaveTextContent("Somosierra, mountain pass");
    await userEvent.click(pass);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("draws nothing without roads on the map, and marks a road-less pass without a line", () => {
    const scenarioPackage = spainPackage();
    const { container } = render(<svg><RoadLayer scenarioPackage={{ ...scenarioPackage, map: withoutSubTerritories(scenarioPackage.map) }} toScreen={(point) => point} /></svg>);
    expect(container.querySelector(".road-layer")).toBeNull();
    cleanup();
    const [first] = scenarioPackage.scenario.links;
    const scenario = { ...scenarioPackage.scenario, links: [{ ...first!, modifiers: [{ kind: "pass" as const, name: "Test" }] }] };
    const { container: passOnly } = render(<svg><RoadLayer scenarioPackage={{ ...scenarioPackage, scenario }} toScreen={(point) => point} /></svg>);
    expect(passOnly.querySelector(".road-line")).toBeNull();
    expect(passOnly.querySelector(".road-pass")).not.toBeNull();
  });
});

describe("the legend follows the layers (U13)", () => {
  it("names roads and passes only with Roads on, and drops rail, order lines and battles when off", () => {
    const { scenario } = spainPackage();
    const state = initialGameState(scenario);
    const order = { factionId: faction("republic"), from: territory("madrid"), kind: "move" as const, to: territory("castilla-la-mancha"), unitId: unit("x") };
    const view = { ...staticMapView, plannedOrders: [order] };
    const orders = legendEntries(scenario, state, view);
    expect(orders).toEqual(expect.arrayContaining(["planned", "rail"]));
    expect(orders).not.toContain("main-road");
    const logistics = legendEntries(scenario, state, view, presetLayers("logistics"));
    expect(logistics).toEqual(expect.arrayContaining(["rail", "main-road", "track", "pass"]));
    expect(logistics).not.toContain("planned");
    render(<MapLegend game={state} layers={presetLayers("logistics")} scenario={scenario} view={view} />);
    expect(screen.getByText("Main road")).toBeInTheDocument();
    expect(screen.getByText("Mountain pass: hover for its name").querySelector(".legend-pass")).not.toBeNull();
  });
});

describe("the Map Layers toolbar (U13)", () => {
  it("offers the presets then More on desktop, and switches a preset or a layer", async () => {
    const onChange = vi.fn();
    render(<LayersToolbar auto={[]} chosen={defaultLayers} layout="side" onChange={onChange} />);
    const bar = screen.getByRole("group", { name: "Map layers" });
    const presetsGroup = within(bar).getByRole("group", { name: "Layer presets" });
    expect(within(presetsGroup).getAllByRole("button").map((button) => button.textContent)).toEqual(["Orders", "Logistics", "Economy"]);
    expect(screen.getByRole("button", { name: "Orders layers" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Logistics layers" }));
    expect(onChange).toHaveBeenLastCalledWith(presetLayers("logistics"));
    await userEvent.click(screen.getByText("More"));
    await userEvent.click(screen.getByRole("switch", { name: "Roads" }));
    expect(onChange).toHaveBeenLastCalledWith(toggleLayer(defaultLayers, "roads"));
    expect(screen.getByText(/^Orders: /u)).toBeInTheDocument();
  });

  it("locks a layer the order in progress needs, and names a mix that is no preset", () => {
    render(<LayersToolbar auto={["roads"]} chosen={["rail"]} layout="side" onChange={vi.fn()} />);
    const roads = screen.getByRole("switch", { name: /^Roads/u });
    expect(roads).toBeChecked();
    expect(roads).toBeDisabled();
    expect(screen.getByText("on for this order")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Battles" })).not.toBeChecked();
    expect(screen.getByText("Your own mix of layers.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /layers$/u, pressed: true })).toBeNull();
  });

  it("folds into one Layers button on a phone", async () => {
    const onChange = vi.fn();
    render(<LayersToolbar auto={[]} chosen={defaultLayers} layout="sheet" onChange={onChange} />);
    expect(screen.queryByRole("group", { name: "Map layers" })).toBeNull();
    await userEvent.click(screen.getByText("Layers"));
    await userEvent.click(screen.getByRole("button", { name: "Economy layers" }));
    expect(onChange).toHaveBeenLastCalledWith(presetLayers("economy"));
  });

  it("keeps its own choice on a map without a store, and hides what is off", async () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1280);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(800);
    const pkg = spainPackage();
    const assets = await testRegistry().loadAssets(spainId);
    render(<CampaignMap assets={assets} game={initialGameState(pkg.scenario)} scenarioPackage={pkg} view={staticMapView} />);
    await screen.findByRole("application", { name: /map/u });
    const map = document.querySelector(".campaign-map");
    expect(map).toHaveAttribute("data-hidden-layers", "roads");
    expect(document.querySelector(".road-layer")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Logistics layers" }));
    expect(map).toHaveAttribute("data-hidden-layers", "order-lines battles");
    expect(document.querySelector(".road-layer")).not.toBeNull();
  });

  it("keeps the player's choice in the store, so it survives the map remounting", async () => {
    const registry = shippedRegistry();
    const { scenario } = registry.require(spainId);
    const store = testStore({
      briefing: { autoOpenedFor: scenario.factions.map((entry) => entry.id) },
      game: { session: { draft: emptyDraft, factionId: faction("republic"), game: { assignments: {}, history: [], locked: {}, scenarioId: spainId, seed: 1, state: initialGameState(scenario) }, phase: "planning" } }
    });
    render(
      <Provider store={store}>
        <RegistryContext value={registry}>
          <MemoryRouter initialEntries={[paths.orders]}>
            <App />
          </MemoryRouter>
        </RegistryContext>
      </Provider>
    );
    await screen.findByRole("application", { name: /map/u });
    await userEvent.click(screen.getByText("Layers"));
    await userEvent.click(screen.getByRole("button", { name: "Economy layers" }));
    expect(store.getState().mapLayers.chosen).toEqual(presetLayers("economy"));
    act(() => { store.dispatch(mapLayersChosen(defaultLayers)); });
    expect(screen.getByRole("button", { name: "Orders layers" })).toHaveAttribute("aria-pressed", "true");
  });
});
