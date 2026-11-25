import type { ReactNode } from "react";
import { cleanup, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateComputerSubmission } from "../main/ai/computerPlayer";
import { GameHeader } from "../main/components/GameHeader";
import { isNeighbor, neighborsOf, requireFaction } from "../main/engine/lookup";
import { seededRandom } from "../main/engine/random";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import type { GameState } from "../main/engine/types";
import { evaluateVictory } from "../main/engine/victory";
import { RegistryContext, useRegistry, useSessionIn } from "../main/hooks";
import { mapTerritory } from "../main/map/anchors";
import { CampaignMap } from "../main/map/CampaignMap";
import { gestureFixtures } from "./gestureFixtures";
import { mapKeyIntent } from "../main/map/keyboard";
import { legendEntries } from "../main/map/MapLegend";
import { MapPane } from "../main/map/MapPane";
import { placeCounters } from "../main/map/placement";
import { groupRoutes } from "../main/map/routes";
import { staticMapView } from "../main/map/view";
import { unitDesignation } from "../main/presentation/text";
import { loadPackage } from "../main/scenarios/loader";
import { builtInSources } from "../main/scenarios/builtInSources";
import { createScenarioRegistry } from "../main/scenarios/registry";
import { applyCommand, createGame } from "../main/game/service";
import type { GameRecord, GameView, Seat } from "../main/game/types";
import { addNotification } from "../main/state/notificationSlice";
import { cancelOrder, chooseDestination, chooseOrder, clearSelection, type PlanningSession } from "../main/state/planning";
import { selectRevealedOrders, selectSubmissionStatus } from "../main/state/selectors";
import { emptyDraft } from "../main/state/session";
import { loadMapAssets } from "../main/state/mapAssetsSlice";
import { createAppStore } from "../main/state/store";
import { ResultsScreen } from "../main/screens/ResolutionScreen";
import { SetupScreen } from "../main/screens/SetupScreen";
import { openSetup } from "../main/state/gameSlice";
import { MemoryRouter } from "react-router";
import tinyMap from "./fixtures/scenarios/tiny-front/map.json";
import tinyScenario from "./fixtures/scenarios/tiny-front/scenario.json";
import { commanded, faction, move, territory, testRegistry, testStore, tiny, tinyId, unit, withUnits, testGame, testPlayer, told } from "./support";

type Json = Record<string, unknown>;

describe("loader edge cases", () => {
  it("indexes optional fields, isolated territories, and terrain layers", () => {
    const scenario = structuredClone(tinyScenario) as unknown as Json;
    const map = structuredClone(tinyMap) as unknown as Json;
    (scenario["territories"] as Json[]).push({ countsForVictory: false, id: "outpost", initialControl: { "@type": "controlled", "@data": { factionId: "blue" } }, isolated: { reason: "Out of reach" }, name: "Outpost" });
    (scenario["cities"] as Json[]).push({ countsForVictory: false, id: "free-town", name: "Free Town", territoryId: "lowlands" });
    (scenario["sources"] as Json[]).push({ id: "atlas", title: "Atlas", url: "https://example.org/atlas" });
    (scenario["units"] as Json[])[0]!["sources"] = [{ reference: "p. 4", sourceId: "atlas" }];
    (scenario["units"] as Json[])[0]!["historicalNote"] = "Note.";
    (map["territories"] as Json)["outpost"] = { label: { tier: "detail", x: 10, y: 10 }, shape: { "@type": "circle", "@data": { r: 4, x: 10, y: 10 } }, unitAnchor: { x: 10, y: 10 } };
    (map["cities"] as Json)["free-town"] = { tier: "detail", x: 120, y: 160 };
    map["terrain"] = { layers: [{ bounds: { height: 400, width: 600, x: 0, y: 0 }, image: "a/relief.webp" }] };
    const loaded = loadPackage({
      assetPaths: new Set(["src/test/fixtures/scenarios/tiny-front/geometry.svg", "src/test/fixtures/scenarios/tiny-front/foot.svg", "a/relief.webp"]),
      mapDocument: map,
      mapPath: "map.json",
      scenarioDocument: scenario,
      scenarioPath: "scenario.json"
    });
    expect(loaded.scenario.index.territories.get(territory("outpost"))?.isolatedReason).toBe("Out of reach");
    expect(loaded.scenario.index.cities.get("free-town" as never)?.initialController).toBeUndefined();
    expect(loaded.scenario.units[0]?.sources).toEqual([{ reference: "p. 4", sourceId: "atlas" }]);
    expect(loaded.map.terrain).toEqual({ layers: [{ bounds: { height: 400, width: 600, x: 0, y: 0 }, imagePath: "a/relief.webp" }] });
    expect(neighborsOf(loaded.scenario, territory("outpost"))).toEqual([]);
  });

  it("reports a non-object document at the root", () => {
    expect(() => loadPackage({ assetPaths: new Set(), mapDocument: tinyMap, mapPath: "m", scenarioDocument: null, scenarioPath: "s" })).toThrow("(root)");
  });

  it("resolves relative map paths and loads url assets, retrying after a failure", async () => {
    let attempts = 0;
    const wide = { height: 800, width: 1200, x: -300, y: -200 };
    const near = { height: 400, width: 600, x: 0, y: 0 };
    const registry = createScenarioRegistry({
      maps: { "/pkg/shared/map.json": { ...tinyMap, terrain: { layers: [{ bounds: wide, image: "t/wide.webp" }, { bounds: near, image: "t/near.png" }] } } },
      rawAssets: {
        "src/test/fixtures/scenarios/tiny-front/foot.svg": () => Promise.resolve("<svg></svg>"),
        "src/test/fixtures/scenarios/tiny-front/geometry.svg": () => Promise.resolve('<svg><path id="tf-westfold"/><path id="tf-highlands"/><path id="tf-harbor"/><path id="tf-lowlands"/></svg>')
      },
      scenarios: { "/pkg/tiny/scenario.json": { ...tinyScenario, map: "../shared/./map.json" }, "/pkg/odd/scenario.json": { map: 7 } },
      urlAssets: {
        "t/near.png": () => (attempts++ === 0 ? Promise.reject(new Error("offline")) : Promise.resolve("near.png")),
        "t/wide.webp": () => Promise.resolve("wide.webp")
      }
    });
    expect(registry.problems).toHaveLength(1);
    await expect(registry.loadAssets(tinyId)).rejects.toThrow("offline");
    const assets = await registry.loadAssets(tinyId);
    expect(assets.terrain).toEqual({ layers: [{ bounds: wide, url: "wide.webp" }, { bounds: near, url: "near.png" }] });
    expect(registry.peekAssets(tinyId)).toBe(assets);
  });
});

describe("engine and computer edge cases", () => {
  it("treats unknown territories as unconnected and fails required lookups loudly", () => {
    expect(isNeighbor(tiny(), territory("nowhere"), territory("harbor"))).toBe(false);
    expect(() => requireFaction(tiny(), faction("green"))).toThrow("unknown faction");
    expect(() => mapTerritory(testRegistry().require(tinyId).map, territory("nowhere"))).toThrow("no map entry");
  });

  it("falls back to the met condition when the tie-break list omits it", () => {
    const entry = { cityThreshold: 2, citiesControlled: 2, factionId: faction("red"), territoriesControlled: 0, territoryThreshold: 3 };
    expect(evaluateVictory([entry], ["territories"])).toEqual({ condition: "cities", factionIds: ["red"] });
  });

  it("holds a lone unit with nowhere useful to go and handles factions with no objectives left", () => {
    const scenario = tiny();
    const state: GameState = { ...withUnits(scenario, [["blue-marines", "blue", "harbor"]]), control: { ...initialGameState(scenario).control, westfold: { factionId: faction("blue"), kind: "controlled" }, highlands: { factionId: faction("blue"), kind: "controlled" } } as GameState["control"] };
    const submission = generateComputerSubmission(scenario, state, faction("blue"), seededRandom(4));
    expect(submission.orders.every((order) => "unitId" in order && order.unitId === unit("blue-marines"))).toBe(true);
    const crowded = withUnits(scenario, [["red-guard", "red", "westfold"], ["red-rangers", "red", "westfold"]]);
    expect(generateComputerSubmission(scenario, crowded, faction("red"), () => 0.999).orders.length).toBeGreaterThan(0);
  });

  it("reports duplicate orders even when the counts are irregular", () => {
    const scenario = tiny();
    const state = withUnits(scenario, [["red-guard", "red", "westfold"]]);
    const result = resolveTurn(scenario, state, [{ factionId: faction("red"), orders: [move("red", "red-guard", "westfold", "lowlands"), move("red", "red-guard", "westfold", "lowlands"), move("red", "red-guard", "westfold", "highlands")] }], 1);
    expect(result.outcomes.filter((outcome) => outcome.kind === "invalid-order")).toHaveLength(3);
  });

  it("refuses invalid submissions and resolves with missing submissions", () => {
    const scenario = tiny();
    const game = (red: Seat): GameRecord => createGame(scenario, { gameId: testGame, rollScheme: "numeric-1", scenarioVersion: "test", seats: { [faction("red")]: red, [faction("blue")]: { kind: "computer" } }, seed: "3", seedChosen: true, timerMinutes: 0 }, 0);
    const played = game({ kind: "human", playerId: testPlayer });
    for (const kind of ["save-orders", "end-turn"] as const) {
      expect(applyCommand(scenario, played, testPlayer, { factionId: faction("red"), kind, orders: [move("red", "red-guard", "westfold", "harbor")], revision: 1, turnNumber: 1 }, 0))
        .toMatchObject({ ok: false, refusal: { code: "bad-orders" } });
    }
    const watched = game({ kind: "computer" });
    for (const record of [watched, { ...watched, orders: {} }]) {
      const after = commanded(scenario, record, { kind: "advance", turnNumber: 1 });
      expect(after.report).toMatchObject({ turnNumber: 1, ...(record === watched ? {} : { submittedOrders: [] }) });
      expect(after.turns).toHaveLength(1);
    }
  });

  it("explains a destination choice made outside move mode", () => {
    const scenario = tiny();
    const game: GameView = { assignments: {}, history: [], ready: [], scenarioId: tinyId, gameId: testGame, state: initialGameState(scenario) };
    const planning: PlanningSession = { draft: emptyDraft, factionId: faction("red"), game, phase: "planning" };
    expect(told(scenario, chooseDestination(scenario, planning, territory("harbor")).draft.feedback)).toContain("choose Move first");
  });

  it("keeps a territory-less draft intact when clearing or cancelling, and refuses orders with no destinations", () => {
    const scenario = tiny();
    const game: GameView = { assignments: {}, history: [], ready: [], scenarioId: tinyId, gameId: testGame, state: initialGameState(scenario) };
    const planning: PlanningSession = { draft: { orders: [], selectedUnitIds: [unit("red-guard")], stage: { orderKind: "move", step: "choose-destination" } }, factionId: faction("red"), game, phase: "planning" };
    expect(clearSelection(planning).draft).toEqual({ orders: [], selectedUnitIds: [] });
    expect(cancelOrder(planning).draft).toEqual({ orders: [], selectedUnitIds: [unit("red-guard")] });
    const stranded: PlanningSession = { ...planning, draft: { orders: [], selectedTerritoryId: territory("westfold"), selectedUnitIds: [unit("ghost")] } };
    expect(chooseOrder(scenario, stranded, "move").draft).toMatchObject({ feedback: { code: "cannot-move-together" }, selectedUnitIds: ["ghost"] });
  });
});

describe("selectors and small helpers", () => {
  it("reports status and reveals only resolved orders", () => {
    const scenario = tiny();
    const game: GameView = { assignments: { [faction("red")]: "local-human" }, history: [], ready: [faction("red")], scenarioId: tinyId, gameId: testGame, state: initialGameState(scenario) };
    expect(selectSubmissionStatus(scenario, { phase: "idle" })).toEqual([]);
    const result = { ...resolveTurn(scenario, game.state, [], 1), turnNumber: 1 };
    expect(selectSubmissionStatus(scenario, { game, phase: "resolution", result }).every((entry) => entry.ready)).toBe(true);
    expect(selectRevealedOrders({ game, phase: "resolution", result })).toEqual([{ factionId: "red", orders: [] }]);
  });

  it("maps every pan and zoom key", () => {
    expect(["A", "D", "W", "S", "ArrowLeft", "ArrowUp", "ArrowDown", "=", "_", "Home", " "].map((key) => mapKeyIntent(key)?.kind)).toEqual(["pan", "pan", "pan", "pan", "pan", "pan", "pan", "zoom-in", "zoom-out", "reset", "select"]);
  });

  it("falls back to the anchor when no free slot exists, and handles empty outcomes", () => {
    const wall = { height: 2000, width: 2000, x: -1000, y: -1000 };
    expect(placeCounters([{ anchor: { x: 0, y: 0 }, anchorKey: "a", id: "a" }], { gap: 2, height: 10, perRow: 2, width: 10 }, [wall]).get("a")).toEqual({ x: -5, y: 5 });
    expect(groupRoutes([], [{ factionId: faction("red"), kind: "no-move" }])).toEqual([]);
    expect(unitDesignation("Spanish Legion")).toBe("SL");
    // Equal attacks tie entering the Isle (M19), Red takes the Harbor behind them, and Blue
    // has nowhere to fall back, so its Marines surrender (M21).
    const scenario = tiny();
    const state = withUnits(scenario, [["red-guard", "red", "harbor"], ["blue-marines", "blue", "harbor"], ["red-rangers", "red", "highlands"], ["r3", "red", "lowlands"]]);
    const result = resolveTurn(scenario, state, [
      { factionId: faction("red"), orders: [move("red", "red-guard", "harbor", "isle"), move("red", "red-rangers", "highlands", "harbor")] },
      { factionId: faction("blue"), orders: [move("blue", "blue-marines", "harbor", "isle")] }
    ], 1);
    expect(legendEntries(scenario, state, { ...staticMapView, outcomes: result.outcomes })).toEqual(expect.arrayContaining(["moved", "disbanded"]));
  });

  it("covers gesture and drag-free pointer paths", () => {
    expect(gestureFixtures()).toBe(true);
  });

  it("builds a store with preloaded state and reports non-Error load failures", async () => {
    const preloaded = createAppStore({ preloadedState: { game: { session: { phase: "idle" } } }, registry: testRegistry() });
    expect(preloaded.getState().game.session.phase).toBe("idle");
    const failing = createScenarioRegistry(builtInSources);
    // The case under test is a loader that rejects with something other than an Error.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    const store = createAppStore({ registry: { ...failing, loadAssets: () => Promise.reject("plain failure") } });
    await store.dispatch(loadMapAssets("spanish-civil-war-1936" as never));
    expect(store.getState().notifications.notifications[0]?.message).toBe("The map for this scenario could not be loaded.");
    store.dispatch({ error: {}, meta: { arg: "x", requestId: "r", requestStatus: "rejected" }, payload: undefined, type: "other/thing/rejected" });
    expect(store.getState().notifications.notifications.at(-1)?.message).toBe("Unexpected application error.");
    store.dispatch(addNotification({ message: "ok", tone: "info" }));
  });
});

describe("component edge cases", () => {
  afterEach(cleanup);

  it("throws helpful errors outside providers and phases", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useRegistry())).toThrow("RegistryContext is missing");
    const store = testStore();
    const wrapper = ({ children }: { readonly children: ReactNode }) => <Provider store={store}><RegistryContext value={testRegistry()}>{children}</RegistryContext></Provider>;
    expect(() => renderHook(() => useSessionIn("planning"), { wrapper })).toThrow("rendered during idle");
    quiet.mockRestore();
  });

  it("shows ready chips and hides the scenario picker with one scenario", () => {
    render(<GameHeader kicker="k" status={[{ abbreviation: "R", factionId: faction("red"), name: "Red", ready: true }]} title="t" />, { wrapper: ({ children }) => <Provider store={testStore()}>{children}</Provider> });
    expect(screen.getByText("ready")).toBeInTheDocument();
    cleanup();
    const registry = createScenarioRegistry(builtInSources);
    const store = createAppStore({ registry });
    store.dispatch(openSetup());
    render(<Provider store={store}><RegistryContext value={registry}><SetupScreen /></RegistryContext></Provider>);
    expect(screen.queryByLabelText("Scenario")).not.toBeInTheDocument();
  });

  it("renders a sheet pane with focus content and without a footer", async () => {
    const onToggle = vi.fn();
    const sizing = { mapWidth: 1000, onStop: vi.fn(), onWidth: vi.fn(), stop: "bar" as const, width: 300 };
    render(<MapPane content={{ body: <p>Body</p>, sheetFocus: <span>Pick one</span>, title: "Orders" }} layout="sheet" {...sizing} onToggle={onToggle} open={false} />);
    expect(screen.getByRole("status")).toHaveTextContent("Pick one");
    await userEvent.setup().click(screen.getByRole("button", { name: "Orders" }));
    expect(onToggle).toHaveBeenCalled();
    cleanup();
    render(<MapPane content={{ body: <p>Body</p>, title: "Orders" }} layout="side" {...sizing} onToggle={onToggle} open />);
    expect(screen.getByText("Body")).toBeVisible();
  });

  it("renders a map without a pane, with disbanded routes and an uncontrolled city", async () => {
    const pkg = testRegistry().require(tinyId);
    const assets = await testRegistry().loadAssets(tinyId);
    // Equal attacks meeting head-on bounce without a battle (M20).
    const state = withUnits(pkg.scenario, [["red-guard", "red", "highlands"], ["blue-marines", "blue", "harbor"], ["red-rangers", "red", "westfold"]]);
    const result = resolveTurn(pkg.scenario, state, [
      { factionId: faction("red"), orders: [move("red", "red-guard", "highlands", "harbor")] },
      { factionId: faction("blue"), orders: [move("blue", "blue-marines", "harbor", "highlands")] }
    ], 1);
    const game: GameState = { ...state, cityControl: {} };
    render(<CampaignMap assets={assets} game={game} scenarioPackage={pkg} view={{ ...staticMapView, outcomes: [...result.outcomes, ...result.outcomes] }} />);
    await screen.findByRole("application", { name: /map/ });
    expect(document.querySelector('[data-route-kind="bounced"]')).not.toBeNull();
    expect(document.querySelector(".map-route-count")).not.toBeNull();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("uses the bottom sheet on narrow maps", async () => {
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(480);
    const pkg = testRegistry().require(tinyId);
    const assets = await testRegistry().loadAssets(tinyId);
    render(<CampaignMap assets={assets} game={initialGameState(pkg.scenario)} pane={{ body: <p>Body</p>, footer: <button type="button">Go</button>, title: "Orders" }} scenarioPackage={pkg} view={staticMapView} />);
    await screen.findByRole("application", { name: /map/ });
    expect(document.querySelector(".campaign-map")).toHaveAttribute("data-pane-layout", "sheet");
    expect(screen.getByRole("button", { name: "Orders" })).toHaveAttribute("aria-expanded", "false");
    width.mockRestore();
  });

  it("names a shared victory", async () => {
    const scenario = tiny();
    const state = initialGameState(scenario);
    const result = { ...resolveTurn(scenario, state, [], 1), turnNumber: 1, victory: { condition: "shared" as const, factionIds: [faction("red"), faction("blue")] } };
    const store = testStore({ game: { session: { game: { assignments: {}, history: [], ready: [], scenarioId: tinyId, gameId: testGame, state }, phase: "game-over", result } } });
    render(<Provider store={store}><RegistryContext value={testRegistry()}><MemoryRouter><ResultsScreen /></MemoryRouter></RegistryContext></Provider>);
    expect(screen.getByRole("heading", { level: 1, name: "Red League and Blue Union share victory" })).toBeVisible();
    expect(await screen.findByText(/equal claims/)).toBeVisible();
    expect(screen.getByText("No territory changed hands.")).toBeVisible();
    expect(screen.getByText(/3 units held/)).toBeVisible();
  });
});
