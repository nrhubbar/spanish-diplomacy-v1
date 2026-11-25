import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../main/app";
import { neighborsOf } from "../main/engine/lookup";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import type { Assignments } from "../main/state/session";
import type { AirMissionOrder, FactionId, GameState, RecruitOrder, Scenario, SubTerritoryId, TurnOutcome, UnitId, UnitTypeId } from "../main/engine/types";
import { victoryProgress } from "../main/engine/victory";
import { viewFor } from "../main/engine/visibility";
import { RegistryContext } from "../main/hooks";
import { describeOutcome } from "../main/presentation/text";
import type { ScenarioRegistry } from "../main/scenarios/registry";
import { paths } from "../main/state/routing";
import type { GameRecord, TurnReport } from "../main/game/types";
import { emptyDraft, type InGameSession } from "../main/state/session";
import { createAppStore } from "../main/state/store";
import { faction, projected, shippedRegistry, spain, spainId, clickTerritoryIn, territory, testRegistry, tiny, unit, testGame } from "./support";

afterEach(cleanup);

const republic = faction("republic");
const north = faction("north");
const south = faction("south");
const funds = "funds" as never;

/** Mounts a session as its host sends it: projected for the player at the screen, with nothing more in the store. */
function mount(registry: ScenarioRegistry, session: InGameSession, path: string, record: Partial<GameRecord> = {}) {
  const game = projected(registry.require(session.game.scenarioId).scenario, session, record);
  const store = createAppStore({ preloadedState: { briefing: { autoOpenedFor: [republic, north, south] }, game }, registry });
  render(
    <Provider store={store}>
      <RegistryContext value={registry}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </RegistryContext>
    </Provider>
  );
  return store;
}

/** What the device holds of the whole game: all of `seen`, and none of `hidden`, each of which the whole game has. */
function expectHeld(store: ReturnType<typeof mount>, whole: unknown, seen: readonly string[], hidden: readonly string[]) {
  const held = JSON.stringify(store.getState().game);
  for (const text of [...seen, ...hidden]) expect(JSON.stringify(whole)).toContain(text);
  for (const text of seen) expect(held).toContain(text);
  for (const text of hidden) expect(held).not.toContain(text);
}

/** A board on which every faction has money, a queued build and a unit in training. */
function busy(scenario: Scenario, extra: Partial<GameState> = {}): GameState {
  const start = initialGameState(scenario);
  const site = (id: string, factionId: FactionId): [SubTerritoryId, GameState["subTerritories"][SubTerritoryId]] => [id as SubTerritoryId, { ...start.subTerritories[id as SubTerritoryId]!, queue: [{ factionId, paid: { [funds]: 3 }, progress: 0, project: { improvement: "rail" as const, kind: "improvement" as const } }] }];
  return {
    ...start,
    subTerritories: { ...start.subTerritories, ...Object.fromEntries([site("barcelona", republic), site("zaragoza", north), site("sevilla", south)]) },
    training: [republic, north, south].map((factionId) => ({ factionId, paid: {}, paused: false, territoryId: territory(factionId === republic ? "catalunya" : factionId === north ? "castilla-y-leon" : "andalucia"), turnsLeft: 2, typeId: "militia-column" as UnitTypeId, unitId: `t_${factionId}_militia-column_x_1` as UnitId })),
    treasuries: { [republic]: { [funds]: 777 }, [north]: { [funds]: 888 }, [south]: { [funds]: 999 } },
    turnNumber: 2,
    ...extra
  };
}

describe("the turn report keeps other factions' secrets (CT-45, CT-46)", () => {
  const registry = shippedRegistry();
  const scenario = registry.require(spainId).scenario;
  const recon = (factionId: FactionId, unitId: string): AirMissionOrder => ({ factionId, kind: "air-mission", mission: { kind: "recon", territoryId: territory("aragon") }, unitId: unit(unitId) });
  const raid: AirMissionOrder = { factionId: south, kind: "air-mission", mission: { kind: "raid", subTerritoryId: "barcelona" as SubTerritoryId }, unitId: unit("south-ju52-bombers") };
  const outcomes: readonly TurnOutcome[] = [
    { kind: "recon", order: recon(republic, "rep-catalan-recon"), territoryId: territory("aragon"), untilTurn: 3 },
    { kind: "grounded", order: recon(north, "north-leon-recon"), refusal: { code: "grounded-by-weather" } },
    { kind: "grounded", order: raid, refusal: { code: "grounded-by-weather" } },
    ...[republic, north, south].map((factionId): TurnOutcome => ({ cut: {}, cutSubTerritoryIds: [], factionId, kind: "income", paid: { [funds]: 5 } }))
  ];
  const line = (outcome: TurnOutcome | undefined) => (outcome === undefined ? "" : describeOutcome(scenario, outcome, outcomes));

  function report(assignments: Assignments): InGameSession {
    const state = busy(scenario);
    const result: TurnReport = { cityChanges: [], controlChanges: [], finalState: state, outcomes, progress: victoryProgress(scenario, state), subTerritoryChanges: [], submittedOrders: outcomes.flatMap((outcome) => ("order" in outcome ? [outcome.order] : [])), turnNumber: state.turnNumber };
    return { game: { assignments, history: [], ready: [], scenarioId: scenario.id, gameId: testGame, state }, phase: "resolution", result };
  }

  for (const humans of [2, 3]) {
    it(`shows only public lines and no balances with ${String(humans)} local players`, async () => {
      const assignments = Object.fromEntries([republic, north, south].map((factionId, index) => [factionId, index < humans ? "local-human" : "computer"])) as Assignments;
      const whole = report(assignments);
      const store = mount(registry, whole, paths.resolution);
      expectHeld(store, whole, [], ["777", "888", "999", '"mission":{"kind":"recon"', '"kind":"income"']);
      await screen.findByRole("application", { name: /map/ });
      // The Map Layers toolbar names its own Rail switch; the secrets are looked for in the rest of the page.
      const toolbar = document.querySelector(".map-layers-toolbar, .map-layers-menu")?.textContent ?? "";
      const page = document.body.textContent.replace(toolbar, "");
      expect(page).toContain(line(outcomes[2]));
      expect(page).not.toContain(line(outcomes[0]));
      expect(page).not.toContain(line(outcomes[1]));
      expect(screen.queryByRole("button", { name: /^Funds/ })).toBeNull();
      for (const secret of ["777", "888", "999", "Rail", "(new)", "reconnaissance"]) expect(page).not.toContain(secret);
    });
  }

  it("shows a single local player its own private lines and balance, and none of the computers'", async () => {
    const whole = report({ [republic]: "local-human", [north]: "computer", [south]: "computer" });
    const store = mount(registry, whole, paths.resolution);
    expectHeld(store, whole, ["777", '"unitId":"rep-catalan-recon"'], ["888", "999", '"unitId":"north-leon-recon"']);
    await screen.findByRole("application", { name: /map/ });
    const page = document.body.textContent;
    expect(page).toContain(line(outcomes[0]));
    expect(page).toContain(line(outcomes[2]));
    expect(page).not.toContain(line(outcomes[1]));
    const chip = screen.getByRole("button", { name: /^Funds/ });
    await userEvent.click(chip);
    expect(within(screen.getByRole("list", { name: "Other factions" })).getAllByText("hidden")).toHaveLength(2);
    for (const secret of ["888", "999"]) expect(document.body.textContent).not.toContain(secret);
  });
});

describe("hot-seat planning after another player locked orders (CT-52)", () => {
  it("shows the earlier player's readiness only: no orders, queue, training or balance", async () => {
    const scenario = spain();
    const state = busy(scenario);
    const locked: RecruitOrder = { factionId: republic, kind: "recruit", territoryId: territory("catalunya"), unitTypeId: "militia-column" as UnitTypeId };
    const own: RecruitOrder = { factionId: north, kind: "recruit", territoryId: territory("castilla-y-leon"), unitTypeId: "militia-column" as UnitTypeId };
    const session: InGameSession = {
      draft: emptyDraft,
      factionId: north,
      game: { assignments: { [republic]: "local-human", [north]: "local-human", [south]: "computer" }, history: [], ready: [republic], scenarioId: spainId, gameId: testGame, state },
      phase: "planning"
    };
    const orders = { [republic]: { ended: true, orders: [locked], revision: 1 }, [north]: { ended: false, orders: [own], revision: 1 }, [south]: { ended: true, orders: [], revision: 1 } };
    const { view } = projected(scenario, session, { orders });
    expect(view.ready).toContain(republic);
    expect(view.saved).toEqual(orders[north]);
    expect(view).not.toHaveProperty("orders");
    const store = mount(testRegistry(), session, paths.orders, { orders });
    expectHeld(store, { orders, session }, [JSON.stringify(own), "888"], [JSON.stringify(locked), "777", "999", "t_republic_militia-column_x_1"]);
    await screen.findByRole("application", { name: /map/ });
    expect(screen.getAllByRole("listitem").find((item) => item.textContent.startsWith("Republican Government"))).toHaveTextContent(/ready$/);
    act(() => { clickTerritoryIn(store, "catalunya"); });
    await userEvent.click(await screen.findByRole("tab", { name: "Buildings" }));
    await userEvent.click(within(screen.getByRole("article", { name: "Barcelona" })).getByRole("button", { expanded: false }));
    expect(screen.getAllByText("Queue hidden")).not.toHaveLength(0);
    await userEvent.click(screen.getByRole("tab", { name: "Recruit" }));
    expect(screen.queryByRole("list", { name: /training$/u })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^Funds/ }));
    expect(within(screen.getByRole("list", { name: "Other factions" })).getAllByText("hidden")).toHaveLength(2);
    for (const secret of ["777", "999", "Militia column (new)"]) expect(document.body.textContent).not.toContain(secret);
  });
});

describe("what recon shows in the pane (U4)", () => {
  it("lists a revealed enemy territory's training and reads its empty queues as empty", async () => {
    const scenario = spain();
    const state = busy(scenario, { reveals: [{ territoryId: territory("catalunya"), untilTurn: 2, viewerFactionId: north }] });
    const emptied = { ...state, subTerritories: { ...state.subTerritories, barcelona: { ...state.subTerritories["barcelona" as SubTerritoryId]!, queue: [] } } };
    const session: InGameSession = { draft: emptyDraft, factionId: north, game: { assignments: { [north]: "local-human", [republic]: "computer", [south]: "computer" }, history: [], ready: [], scenarioId: spainId, gameId: testGame, state: emptied }, phase: "planning" };
    const store = mount(testRegistry(), session, paths.orders);
    await screen.findByRole("application", { name: /map/ });
    act(() => { clickTerritoryIn(store, "catalunya"); });
    await userEvent.click(await screen.findByRole("tab", { name: /^Recruit/u }));
    expect(within(screen.getByRole("list", { name: "Barcelona training" })).getByText("(Republican Government, recon)", { exact: false })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /^Buildings/u }));
    await userEvent.click(within(screen.getByRole("article", { name: "Barcelona" })).getByRole("button", { expanded: false }));
    expect(screen.getAllByText("Queue empty (recon)").length).toBeGreaterThan(0);
    expect(screen.queryByText("Queue hidden")).toBeNull();
  });
});

describe("only the host holds the whole game (m3)", () => {
  const sources = () => {
    const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
    });
    return files("src/main").map((path) => ({ path, text: readFileSync(path, "utf8") }));
  };
  const matching = (pattern: RegExp) => sources().filter(({ text }) => pattern.test(text)).map(({ path }) => path).sort();

  it("keeps the record and the service out of everything but the host, which main.tsx starts", () => {
    const outside = (paths: readonly string[]) => paths.filter((path) => !path.startsWith(join("src/main/game", "/")));
    expect(outside(matching(/\bGameRecord\b/))).toEqual([]);
    expect(outside(matching(/(?:from|import\()\s*"[^"]*\/game\/(?:commandSchema|localHost|projection|service)"/))).toEqual([join("src/main", "main.tsx")]);
  });

  it("leaves every screen to read the session through useSession", () => {
    expect(matching(/\bgame\.session\b/)).toEqual([join("src/main", "audio", "start.ts"), join("src/main", "hooks.ts"), join("src/main", "state", "commands.ts")]);
  });
});

describe("viewFor without an economy (CT-37)", () => {
  it("returns an equal state after turns of play, for every viewer", () => {
    const scenario = tiny();
    let state = initialGameState(scenario);
    for (let turn = 1; turn <= 3; turn += 1) {
      const orders = Object.values(state.units).slice(0, 2).flatMap((army) => {
        const neighbour = neighborsOf(scenario, army.territoryId)[0]?.territoryId;
        return neighbour === undefined ? [] : [{ factionId: army.factionId, from: army.territoryId, kind: "move" as const, to: neighbour, unitId: army.id }];
      });
      state = { ...resolveTurn(scenario, state, scenario.factions.map((entry) => ({ factionId: entry.id, orders: orders.filter((order) => order.factionId === entry.id) })), turn).finalState, turnNumber: turn + 1 };
    }
    expect(state).not.toEqual(initialGameState(scenario));
    for (const viewer of [...scenario.factions.map((entry) => entry.id), undefined]) expect(viewFor(scenario, state, viewer)).toEqual(state);
  });
});
