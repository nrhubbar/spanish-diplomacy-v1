import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../main/app";
import { raisedUnitId } from "../../main/engine/recruitment/rules";
import { initialGameState } from "../../main/engine/resolution";
import type { BuildingId, GameState, Scenario, SubTerritoryId, SystemOutcome, TerritoryId, UnitTypeId } from "../../main/engine/types";
import { RegistryContext } from "../../main/hooks";
import { cancelAction } from "../../main/screens/shell/cancel";
import { DestinationPanel } from "../../main/screens/shell/DestinationPanel";
import { planningMapHandlers } from "../../main/screens/shell/mapHandlers";
import { paneViewTitle } from "../../main/screens/shell/paneTitles";
import { SelectionBar } from "../../main/screens/shell/SelectionBar";
import { TerritoryView } from "../../main/screens/shell/views/TerritoryView";
import { historyEntry } from "../../main/state/history";
import { openView, type PaneView, pushView } from "../../main/state/paneSlice";
import type { Draft, Session } from "../../main/state/session";
import { faction, move, spain, spainId, spainWithAir, territory, testRegistry, testStore, unit } from "../support";

afterEach(cleanup);

const republic = faction("republic");
const sub = (id: string): SubTerritoryId => id as SubTerritoryId;

function planningStore(state: GameState, draft: Draft = { orders: [], selectedUnitIds: [] }, history?: Parameters<typeof historyEntry>[2], scenario: Scenario = spain()) {
  const game = {
    assignments: { [faction("north")]: "computer" as const, [republic]: "local-human" as const, [faction("south")]: "computer" as const },
    history: history === undefined ? [] : [historyEntry(scenario, state, history)],
    locked: {},
    scenarioId: spainId,
    seed: 1,
    // Turn 2: the Briefing opens by itself only on turn 1.
    state: { ...state, turnNumber: 2 }
  };
  const session: Session = { draft, factionId: republic, game, phase: "planning" };
  return testStore({ game: { session } });
}

function renderOrders(store: ReturnType<typeof testStore>) {
  const user = userEvent.setup();
  render(
    <Provider store={store}>
      <RegistryContext value={testRegistry()}>
        <MemoryRouter initialEntries={["/orders"]}>
          <App />
        </MemoryRouter>
      </RegistryContext>
    </Provider>
  );
  return { user };
}

const pane = (): HTMLElement => document.querySelector<HTMLElement>(".map-pane")!;
const banner = (): HTMLElement => screen.getByRole("banner");

describe("U1: the top bar", () => {
  it("opens Last turn, Recruitment and Building in the pane, with their counts, and back again", async () => {
    const start = initialGameState(spain());
    const trainingId = raisedUnitId(republic, "infantry-regiment" as UnitTypeId, 1);
    const state: GameState = {
      ...start,
      training: [{ factionId: republic, paid: {}, paused: false, territoryId: territory("catalunya"), turnsLeft: 2, typeId: "infantry-regiment" as UnitTypeId, unitId: trainingId }]
    };
    const store = planningStore(state, { orders: [], recruits: [{ factionId: republic, kind: "recruit", territoryId: territory("valencia"), unitTypeId: "militia-column" as UnitTypeId }], selectedUnitIds: [] });
    const { user } = renderOrders(store);
    await screen.findByRole("complementary", { name: "This turn" });
    const nav = within(banner()).getByRole("navigation", { name: "This turn's views" });
    expect(within(nav).getByRole("button", { name: "Recruitment 2" })).toHaveAttribute("aria-pressed", "false");
    expect(within(nav).getByRole("button", { name: "Building 0" })).toBeVisible();

    await user.click(within(nav).getByRole("button", { name: "Recruitment 2" }));
    expect(screen.getByRole("complementary", { name: "Recruitment" })).toBeVisible();
    expect(within(nav).getByRole("button", { name: "Recruitment 2" })).toHaveAttribute("aria-pressed", "true");
    // U9: the global view lists the same two items the count does, by territory.
    expect(within(pane()).getAllByRole("progressbar")).toHaveLength(1);
    expect(within(pane()).getByRole("list", { name: "Catalu\u00f1a training" })).toHaveTextContent("2 turns left");
    expect(within(pane()).getByRole("list", { name: "Valencia training" })).toHaveTextContent("starts this turn");
    // The back link names the view under it.
    await user.click(within(pane()).getByRole("button", { name: "This turn" }));
    expect(screen.getByRole("complementary", { name: "This turn" })).toBeVisible();

    await user.click(within(nav).getByRole("button", { name: "Building 0" }));
    expect(screen.getByRole("complementary", { name: "Building" })).toBeVisible();
    expect(within(pane()).getByText(/^Nothing is being built\./u)).toBeVisible();
    // Pressing the shown view's button again goes back.
    await user.click(within(nav).getByRole("button", { name: "Building 0" }));
    expect(screen.getByRole("complementary", { name: "This turn" })).toBeVisible();

    // Turn 1 of this record has no report yet.
    await user.click(within(nav).getByRole("button", { name: "Last turn" }));
    expect(within(pane()).getByText("This is the first turn: there is no report yet.")).toBeVisible();
  });

  it("leaves Recruitment and Building out without recruitment or an economy", async () => {
    const scenario = spain();
    const bare: Scenario = { ...scenario, rules: { ...scenario.rules, economy: "none", recruitment: "none" } };
    const store = planningStore(initialGameState(scenario));
    const user = userEvent.setup();
    const registry = testRegistry();
    const plain = { ...registry, require: (id: Parameters<typeof registry.require>[0]) => ({ ...registry.require(id), scenario: bare }) };
    render(
      <Provider store={store}>
        <RegistryContext value={plain}>
          <MemoryRouter initialEntries={["/orders"]}>
            <App />
          </MemoryRouter>
        </RegistryContext>
      </Provider>
    );
    await screen.findByRole("complementary", { name: "This turn" });
    const nav = within(banner()).getByRole("navigation", { name: "This turn's views" });
    expect(within(nav).getAllByRole("button").map((button) => button.textContent)).toEqual(["Last turn"]);
    await user.click(within(nav).getByRole("button", { name: "Last turn" }));
    expect(screen.getByRole("complementary", { name: "Last turn" })).toBeVisible();
  });

  it("opens the menu, closes it with Escape or a click outside, and goes to Settings", async () => {
    const { user } = renderOrders(planningStore(initialGameState(spain())));
    await screen.findByRole("complementary", { name: "This turn" });
    const menu = within(banner()).getByRole("button", { name: "Menu" });
    await user.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(menu).toHaveAttribute("aria-expanded", "false");
    await user.click(menu);
    // A key other than Escape, or a click inside, leaves it open.
    await user.keyboard("a");
    await user.click(screen.getByRole("group", { name: "Game menu" }));
    expect(menu).toHaveAttribute("aria-expanded", "true");
    await user.click(within(banner()).getByRole("heading", { level: 1 }));
    expect(menu).toHaveAttribute("aria-expanded", "false");
    await user.click(menu);
    await user.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "false");
    await user.click(menu);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("complementary", { name: "This turn" })).toBeVisible();
  });
});

describe("U2: End Turn", () => {
  it("ends at once when every army has an order", async () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    const own = Object.values(state.units).filter((entry) => entry.factionId === republic).map((entry) => entry.id);
    const store = planningStore(state, { orderedToStay: own, orders: [], selectedUnitIds: [] });
    const { user } = renderOrders(store);
    await screen.findByRole("complementary", { name: "This turn" });
    await user.click(within(banner()).getByRole("button", { name: "End Turn" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(store.getState().game.session.phase).not.toBe("planning");
  });

  it("lists the armies with no order and goes back on Escape", async () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    const own = Object.values(state.units).filter((entry) => entry.factionId === republic).map((entry) => entry.id);
    const store = planningStore(state, { orderedToStay: own.slice(1), orders: [], selectedUnitIds: [] });
    const { user } = renderOrders(store);
    await screen.findByRole("complementary", { name: "This turn" });
    await user.click(within(banner()).getByRole("button", { name: "End Turn" }));
    const confirm = screen.getByRole("alertdialog", { name: "1 army has no order" });
    expect(within(confirm).getAllByRole("listitem")).toHaveLength(1);
    expect(within(confirm).getByRole("button", { name: "Back" })).toHaveFocus();
    await user.keyboard("a");
    expect(screen.getByRole("alertdialog")).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(store.getState().game.session.phase).toBe("planning");
  });
});

describe("U3: the pane's views", () => {
  it("shows every view by its title, with placeholders for the views still to come", async () => {
    const store = planningStore(initialGameState(spain()));
    renderOrders(store);
    await screen.findByRole("complementary", { name: "This turn" });
    const views: readonly [PaneView, string][] = [
      [{ kind: "invade", target: territory("aragon") }, "Invade Arag\u00f3n"],
      [{ kind: "reinforce", target: territory("madrid") }, "Reinforce Madrid"],
      [{ kind: "build", territory: territory("catalunya") }, "Build in Catalu\u00f1a"],
      [{ kind: "build", subTerritory: sub("girona"), territory: territory("catalunya") }, "Build in Girona"],
      [{ kind: "recruit", territory: territory("catalunya") }, "Recruit in Catalu\u00f1a"],
      [{ kind: "territory", id: territory("madrid") }, "Territory info"]
    ];
    for (const [view, title] of views) {
      act(() => { store.dispatch(pushView(view)); });
      expect(screen.getByRole("complementary", { name: title })).toBeVisible();
      expect(paneViewTitle(spain(), view)).toBe(title);
    }
    expect(pane().querySelector("[data-placeholder]")).toBeNull();
    act(() => { store.dispatch(openView({ kind: "thisTurn" })); });
    expect(screen.getByRole("complementary", { name: "This turn" })).toBeVisible();
  });

  it("lists This turn's orders by type or by region and cancels them", async () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    const draft: Draft = {
      builds: [{ factionId: republic, kind: "build", project: { buildingId: "fortifications" as BuildingId, kind: "building" }, subTerritoryId: sub("barcelona") }],
      orders: [move("republic", "rep-wad-ras-1", "madrid", "aragon")],
      replenishments: [{ factionId: republic, kind: "replenish", unitId: unit("rep-covadonga-4") }],
      selectedUnitIds: []
    };
    const store = planningStore(state, draft, undefined, scenario);
    const { user } = renderOrders(store);
    await screen.findByRole("complementary", { name: "This turn" });
    expect(within(pane()).getByText("Turn 2 \u00b7 3 orders given this turn")).toBeVisible();
    expect(within(pane()).getByRole("list", { name: "Unit orders (2)" })).toBeVisible();
    expect(within(pane()).getByRole("list", { name: "Builds (1)" })).toBeVisible();
    await user.click(within(pane()).getByRole("button", { name: "By region" }));
    expect(within(pane()).getByRole("button", { name: "By region" })).toHaveAttribute("aria-pressed", "true");
    expect(within(pane()).getByRole("list", { name: "Madrid (2)" })).toBeVisible();
    await user.click(within(pane()).getByRole("button", { name: /^Cancel Fortifications/ }));
    expect(within(pane()).queryByRole("list", { name: "Catalu\u00f1a (1)" })).not.toBeInTheDocument();
    const session = store.getState().game.session;
    expect(session.phase === "planning" ? session.draft.builds : undefined).toEqual([]);
  });

  it("says when no order is given yet", async () => {
    renderOrders(planningStore(initialGameState(spain())));
    await screen.findByRole("complementary", { name: "This turn" });
    expect(within(pane()).getByText(/^No orders yet\./u)).toBeVisible();
  });

  it("shows last turn's report by faction, the player's own first", async () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    const theirs: SystemOutcome = { demoralized: false, factionId: faction("south"), fatigue: 1, kind: "fatigue", unitId: unit("south-granada-6") };
    const ours: SystemOutcome = { factionId: republic, kind: "build-completed", project: { buildingId: "fortifications" as BuildingId, kind: "building" }, subTerritoryId: sub("barcelona") };
    const store = planningStore(state, undefined, [theirs, ours]);
    const { user } = renderOrders(store);
    await screen.findByRole("complementary", { name: "This turn" });
    await user.click(within(banner()).getByRole("button", { name: "Last turn" }));
    const last = screen.getByRole("complementary", { name: "Last turn" });
    expect(within(last).getByText(/^Turn 1 \u00b7 what happened, your faction first$/u)).toBeVisible();
    const sections = [...last.querySelectorAll(".faction-report")].map((section) => section.querySelector("h4")?.textContent);
    expect(sections[0]).toMatch(/^Republican Government \(you\)1 event$/u);
    expect(sections).toHaveLength(2);
  });
});

describe("U4: the selection bar", () => {
  it("names the selection with no territory, and leaves out a feedback line it does not have", () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    const game = { assignments: {}, history: [], locked: {}, scenarioId: spainId, seed: 1, state };
    const session = { draft: { orders: [], selectedUnitIds: [unit("rep-wad-ras-1")] }, factionId: republic, game, phase: "planning" as const };
    render(<Provider store={testStore({ game: { session } })}><SelectionBar scenario={scenario} session={session} /></Provider>);
    expect(screen.getByText("1 unit selected").parentElement).toHaveTextContent(/^1 unit selectedClear$/u);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  });
});

describe("This turn's Cancel", () => {
  it("dispatches the action that undoes each kind of line", () => {
    const where: TerritoryId = territory("valencia");
    expect(cancelAction({ kind: "order", unitId: unit("a") }).type).toBe("game/removePlannedOrder");
    expect(cancelAction({ kind: "air", unitId: unit("a") })).toEqual({ payload: { unitId: "a" }, type: "game/planAirMission" });
    expect(cancelAction({ kind: "sack", unitId: unit("a") }).type).toBe("game/toggleSackOrder");
    expect(cancelAction({ kind: "recruit", territoryId: where, unitTypeId: "militia-column" as UnitTypeId })).toEqual({ payload: { quantity: 0, territoryId: "valencia", unitTypeId: "militia-column" }, type: "game/changeRecruitQuantity" });
    expect(cancelAction({ index: 2, kind: "build" })).toEqual({ payload: 2, type: "game/cancelBuildOrder" });
  });
});

describe("the planning map's clicks (U3)", () => {
  const scenario = spain();
  const record = (draft: Draft) => {
    const actions: string[] = [];
    const handlers = planningMapHandlers((action) => actions.push(action.type), scenario, draft);
    return { actions, handlers };
  };

  it("selects and opens Territory Info, except while a destination is chosen", () => {
    const idle = record({ orders: [], selectedUnitIds: [] });
    idle.handlers.onSelectTerritory(territory("madrid"));
    idle.handlers.onSelectUnit(initialGameState(scenario).units[unit("rep-wad-ras-1")]!);
    expect(idle.actions).toEqual(["game/clickMapTerritory", "pane/pushView", "game/clickMapUnit", "pane/pushView"]);
    const choosing = record({ orders: [], selectedTerritoryId: territory("madrid"), selectedUnitIds: [unit("rep-wad-ras-1")], stage: { orderKind: "move", step: "choose-destination" } });
    choosing.handlers.onSelectTerritory(territory("aragon"));
    expect(choosing.actions).toEqual(["game/clickMapTerritory"]);
  });

  it("focuses a sub-territory on a second click inside the selected territory", () => {
    const inMadrid = record({ orders: [], selectedTerritoryId: territory("madrid"), selectedUnitIds: [] });
    inMadrid.handlers.onSelectSubTerritory(sub("madrid"));
    inMadrid.handlers.onSelectSubTerritory(sub("burgos"));
    expect(inMadrid.actions).toEqual(["game/focusSubTerritory"]);
  });
});

describe("the destination panel (O1, C15)", () => {
  const scenario = spain();
  const state = initialGameState(scenario);
  const game = { assignments: {}, history: [], locked: {}, scenarioId: spainId, seed: 1, state };
  const show = (draft: Draft) => {
    const session = { draft, factionId: republic, game, phase: "planning" as const };
    return render(<Provider store={testStore({ game: { session } })}><RegistryContext value={testRegistry()}><DestinationPanel estimates={new Map()} scenario={scenario} session={session} /></RegistryContext></Provider>);
  };
  const selected: Draft = { orders: [], selectedTerritoryId: territory("asturias"), selectedUnitIds: [unit("rep-wad-ras-1")] };

  it("shows nothing outside a destination choice", () => {
    expect(show(selected).container).toBeEmptyDOMElement();
    cleanup();
    expect(show({ orders: [], selectedUnitIds: [], stage: { orderKind: "move", step: "choose-destination" } }).container).toBeEmptyDOMElement();
  });

  it("shows a Withdraw's callout alone, and a Move's army without odds when there are none", () => {
    show({ ...selected, stage: { orderKind: "withdraw", step: "choose-destination" } });
    expect(screen.getByRole("button", { name: "Cancel withdrawal" })).toHaveFocus();
    expect(screen.queryByRole("group", { name: "Army leaving" })).not.toBeInTheDocument();
    cleanup();
    show({ ...selected, selectedTerritoryId: territory("madrid"), stage: { orderKind: "move", step: "choose-destination" } });
    expect(screen.getByRole("button", { name: "Cancel move" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Army leaving" })).toBeVisible();
    expect(screen.queryByRole("list", { name: "Destinations" })).not.toBeInTheDocument();
  });
});

describe("Territory Info with an aircraft selected (U2)", () => {
  it("shows the aircraft's missions", () => {
    const scenario = spainWithAir();
    const state = initialGameState(scenario);
    const game = { assignments: {}, history: [], locked: {}, scenarioId: spainId, seed: 1, state };
    const session = { draft: { orders: [], selectedAircraftId: unit("rep-breguet-bombers"), selectedTerritoryId: territory("madrid"), selectedUnitIds: [] }, factionId: republic, game, phase: "planning" as const };
    render(<Provider store={testStore({ game: { session } })}><RegistryContext value={testRegistry()}><TerritoryView scenario={scenario} session={session} territoryId={territory("madrid")} /></RegistryContext></Provider>);
    expect(screen.getByRole("heading", { name: /Breguet/u })).toBeVisible();
  });
});

describe("the phone's This turn bar while a destination is chosen (A2)", () => {
  it("shows the odds note and Cancel for a Move, and the plain line for a Withdraw", async () => {
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
    const state = initialGameState(spain());
    const own = (where: string) => Object.values(state.units).filter((entry) => entry.factionId === republic && entry.territoryId === where).map((entry) => entry.id);
    const store = planningStore(state, { orders: [], selectedTerritoryId: territory("madrid"), selectedUnitIds: own("madrid"), stage: { orderKind: "move", step: "choose-destination" } });
    const { user } = renderOrders(store);
    await screen.findByRole("complementary", { name: "This turn" });
    const bar = document.querySelector<HTMLElement>(".map-pane-bar-focus")!;
    expect(within(bar).getByRole("button", { name: "About the destination odds" })).toBeInTheDocument();
    await user.click(within(bar).getByRole("button", { name: "Cancel" }));
    const session = store.getState().game.session;
    expect(session.phase === "planning" ? session.draft.stage : "?").toBeUndefined();
    cleanup();

    renderOrders(planningStore(state, { orders: [], selectedTerritoryId: territory("asturias"), selectedUnitIds: own("asturias"), stage: { orderKind: "withdraw", step: "choose-destination" } }));
    await screen.findByRole("complementary", { name: "This turn" });
    expect(document.querySelector(".map-pane-bar-focus")).toHaveTextContent(/^Choose a highlighted territory\.Cancel$/u);
    width.mockRestore();
  });
});

describe("U2, U3: stay orders in This turn", () => {
  it("lists the armies told to stay, without those given another order since, and cancels them", async () => {
    const state = initialGameState(spain());
    const draft: Draft = {
      feedback: "1 unit will entrench.",
      orderedToStay: [unit("rep-wad-ras-1"), unit("rep-covadonga-4"), unit("rep-gone")],
      orders: [move("republic", "rep-covadonga-4", "madrid", "aragon")],
      selectedUnitIds: []
    };
    const store = planningStore(state, draft);
    const { user } = renderOrders(store);
    await screen.findByRole("complementary", { name: "This turn" });
    const list = within(pane()).getByRole("list", { name: "Unit orders (2)" });
    expect(within(list).getAllByRole("listitem").map((item) => item.querySelector(".order-route")?.textContent)).toEqual([
      "Move · Madrid → Aragón",
      "Entrench · Madrid"
    ]);
    await user.click(within(list).getByRole("button", { name: /^Cancel Wad-Ras/u }));
    expect(within(pane()).getByRole("list", { name: "Unit orders (1)" })).toBeVisible();
    // The feedback was about the cancelled order, so it goes.
    expect(within(pane()).queryByText("1 unit will entrench.")).not.toBeInTheDocument();
  });
});
