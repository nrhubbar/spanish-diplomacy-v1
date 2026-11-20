import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../main/app";
import { neighborsOf } from "../main/engine/lookup";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import type { Assignments } from "../main/state/session";
import type { AirMissionOrder, FactionId, GameState, PlayerSubmission, Scenario, SubTerritoryId, TurnOutcome, TurnResolutionResult, UnitId, UnitTypeId } from "../main/engine/types";
import { victoryProgress } from "../main/engine/victory";
import { viewFor } from "../main/engine/visibility";
import { RegistryContext } from "../main/hooks";
import { describeOutcome } from "../main/presentation/text";
import type { ScenarioRegistry } from "../main/scenarios/registry";
import { clickMapTerritory } from "../main/state/gameSlice";
import { paths } from "../main/state/routing";
import { emptyDraft, type Session } from "../main/state/session";
import { createAppStore } from "../main/state/store";
import { visibleSession } from "../main/state/visible";
import { faction, shippedRegistry, spain, spainId, territory, testRegistry, tiny, unit } from "./support";

afterEach(cleanup);

const republic = faction("republic");
const north = faction("north");
const south = faction("south");
const funds = "funds" as never;

function mount(registry: ScenarioRegistry, session: Session, path: string) {
  const store = createAppStore({ preloadedState: { briefing: { autoOpenedFor: [republic, north, south] }, game: { session } }, registry });
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
    { kind: "grounded", order: recon(north, "north-leon-recon"), reason: "weather" },
    { kind: "grounded", order: raid, reason: "weather" },
    ...[republic, north, south].map((factionId): TurnOutcome => ({ cut: {}, cutSubTerritoryIds: [], factionId, kind: "income", paid: { [funds]: 5 } }))
  ];
  const line = (outcome: TurnOutcome | undefined) => (outcome === undefined ? "" : describeOutcome(scenario, outcome, outcomes));

  function report(assignments: Assignments): Session {
    const state = busy(scenario);
    const result: TurnResolutionResult = { cityChanges: [], controlChanges: [], finalState: state, outcomes, progress: victoryProgress(scenario, state), subTerritoryChanges: [], submittedOrders: outcomes.flatMap((outcome) => ("order" in outcome ? [outcome.order] : [])) };
    return { game: { assignments, history: [], locked: {}, scenarioId: scenario.id, seed: 1, state }, phase: "resolution", result };
  }

  for (const humans of [2, 3]) {
    it(`shows only public lines and no balances with ${String(humans)} local players`, async () => {
      const assignments = Object.fromEntries([republic, north, south].map((factionId, index) => [factionId, index < humans ? "local-human" : "computer"])) as Assignments;
      mount(registry, report(assignments), paths.resolution);
      await screen.findByRole("application", { name: /map/ });
      const page = document.body.textContent;
      expect(page).toContain(line(outcomes[2]));
      expect(page).not.toContain(line(outcomes[0]));
      expect(page).not.toContain(line(outcomes[1]));
      expect(screen.queryByRole("button", { name: /^Funds/ })).toBeNull();
      for (const secret of ["777", "888", "999", "Rail", "(new)", "reconnaissance"]) expect(page).not.toContain(secret);
    });
  }

  it("shows a single local player its own private lines and balance, and none of the computers'", async () => {
    mount(registry, report({ [republic]: "local-human", [north]: "computer", [south]: "computer" }), paths.resolution);
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
    const locked: PlayerSubmission = { factionId: republic, orders: [{ factionId: republic, kind: "recruit", territoryId: territory("catalunya"), unitTypeId: "militia-column" as UnitTypeId }] };
    const session: Session = {
      draft: emptyDraft,
      factionId: north,
      game: { assignments: { [republic]: "local-human", [north]: "local-human", [south]: "computer" }, history: [], locked: { [republic]: locked }, scenarioId: spainId, seed: 1, state },
      phase: "planning"
    };
    const seen = visibleSession(scenario, session);
    expect(seen.game.locked).toEqual({ [republic]: { factionId: republic, orders: [] } });
    const store = mount(testRegistry(), session, paths.orders);
    await screen.findByRole("application", { name: /map/ });
    expect(screen.getAllByRole("listitem").find((item) => item.textContent.startsWith("Republican Government"))).toHaveTextContent(/ready$/);
    store.dispatch(clickMapTerritory(territory("catalunya")));
    await userEvent.click(await screen.findByRole("tab", { name: "Build" }));
    expect(screen.getAllByText("Queue hidden")).not.toHaveLength(0);
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
    const session: Session = { draft: emptyDraft, factionId: north, game: { assignments: { [north]: "local-human", [republic]: "computer", [south]: "computer" }, history: [], locked: {}, scenarioId: spainId, seed: 1, state: emptied }, phase: "planning" };
    const store = mount(testRegistry(), session, paths.orders);
    await screen.findByRole("application", { name: /map/ });
    store.dispatch(clickMapTerritory(territory("catalunya")));
    expect(await screen.findByText(/Militia column \(new\) \(Republican Government, recon\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Build" }));
    expect(screen.getAllByText("Queue empty (recon)").length).toBeGreaterThan(0);
    expect(screen.queryByText("Queue hidden")).toBeNull();
  });
});

describe("only the session hook reads the raw session (m3)", () => {
  it("leaves every other module to read through useSession", () => {
    const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
    });
    const readers = files("src/main").filter((path) => /\bgame\.session\b/.test(readFileSync(path, "utf8")));
    expect(readers).toEqual([join("src/main", "hooks.ts")]);
  });
});

describe("viewFor under m2-strength (CT-37)", () => {
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
