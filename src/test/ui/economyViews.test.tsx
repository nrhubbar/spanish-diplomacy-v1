import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it } from "vitest";
import { initialGameState } from "../../main/engine/resolution";
import type { BuildingId, GameState, QueueItem, Scenario, SubTerritoryId, SubTerritoryState, UnitTypeId } from "../../main/engine/types";
import { RegistryContext } from "../../main/hooks";
import { ProductionTab } from "../../main/screens/pane/ProductionTab";
import { PaneViewBody } from "../../main/screens/shell/PaneViewBody";
import type { PaneView } from "../../main/state/paneSlice";
import type { PlanningSession } from "../../main/state/planning";
import { emptyDraft, type Draft } from "../../main/state/session";
import { faction, spain, spainId, territory, testRegistry, testStore } from "../support";
import { pinned } from "../pinned";

afterEach(cleanup);

const scenario = pinned(spain());
const start = initialGameState(scenario);
const republic = faction("republic");
const north = faction("north");
const sub = (id: string): SubTerritoryId => id as SubTerritoryId;
const fortifications = { buildingId: "fortifications" as BuildingId, kind: "building" as const };
const item = (progress: number): QueueItem => ({ factionId: republic, paid: { funds: 6 } as never, project: fortifications, progress });

function withSite(state: GameState, id: string, change: Partial<SubTerritoryState>): GameState {
  return { ...state, subTerritories: { ...state.subTerritories, [sub(id)]: { ...state.subTerritories[sub(id)]!, ...change } } };
}

function show(view: PaneView, state: GameState = start, draft: Draft = emptyDraft, given: Scenario = scenario) {
  const session: PlanningSession = { draft, factionId: republic, game: { assignments: { [republic]: "local-human" }, history: [], locked: {}, scenarioId: spainId, seed: 1, state }, phase: "planning" };
  const store = testStore({ game: { session } });
  const user = userEvent.setup();
  const node = () => {
    const now = store.getState().game.session as PlanningSession;
    return <Provider store={store}><RegistryContext value={testRegistry()}><PaneViewBody scenario={given} session={now} view={view} /></RegistryContext></Provider>;
  };
  const rendered = render(node());
  return { rerender: () => { rendered.rerender(node()); }, store, user };
}

const draftOf = (store: ReturnType<typeof testStore>): Draft => (store.getState().game.session as PlanningSession).draft;

describe("Global Recruitment (U9)", () => {
  const training = (where: string, turnsLeft: number, paused = false, factionId = republic) => ({
    factionId, paid: {}, paused, territoryId: territory(where), turnsLeft, typeId: "infantry-regiment" as UnitTypeId, unitId: `t-${where}-${String(turnsLeft)}` as never
  });

  it("lists units in training and this turn's orders by territory, marks a paused one, cancels an order and opens a Recruit tab", async () => {
    const state: GameState = { ...start, training: [training("catalunya", 1), training("pais-vasco", 2, true), training("madrid", 1, false, north)] };
    const draft: Draft = { ...emptyDraft, recruits: [{ factionId: republic, kind: "recruit", territoryId: territory("catalunya"), unitTypeId: "militia-column" as UnitTypeId }] };
    const { rerender, store, user } = show({ kind: "recruitment" }, state, draft);
    const summary = document.querySelector(".queue-summary")!;
    expect(summary.textContent).toMatch(/^2 in training1 ready next turn1 ordered this turn.+ committed$/u);
    const catalunya = screen.getByRole("list", { name: "Cataluña training" });
    expect(within(catalunya).getAllByRole("listitem").map((row) => row.querySelector(".queue-status")?.textContent)).toEqual(["1 turn left", "starts this turn · 1 turn"]);
    expect(within(catalunya).getAllByRole("progressbar")).toHaveLength(1);
    const paused = screen.getByRole("list", { name: "País Vasco training" }).closest("li.queue-group")!;
    expect(within(paused as HTMLElement).getByText("Paused · contested")).toBeTruthy();
    expect(paused.textContent).toContain("progress is kept");
    expect(screen.queryByRole("list", { name: "Madrid training" })).toBeNull();
    await user.click(within(catalunya).getByRole("button", { name: "Cancel Militia column" }));
    expect(draftOf(store).recruits).toEqual([]);
    rerender();
    await user.click(screen.getByRole("button", { name: "Cataluña" }));
    expect(store.getState().pane.stack.at(-1)).toEqual({ kind: "recruit", territory: territory("catalunya") });
  });

  it("tells two orders of a kind apart, and cancels the one asked for", async () => {
    const order = (typeId: string) => ({ factionId: republic, kind: "recruit" as const, territoryId: territory("catalunya"), unitTypeId: typeId as UnitTypeId });
    const draft: Draft = { ...emptyDraft, recruits: [order("militia-column"), order("infantry-regiment"), order("militia-column")] };
    const { store, user } = show({ kind: "recruitment" }, start, draft);
    expect(screen.getByRole("button", { name: "Cancel Militia column, order 1 of 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel Infantry regiment" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel Militia column, order 2 of 2" }));
    expect(draftOf(store).recruits?.map((each) => each.unitTypeId)).toEqual(["militia-column", "infantry-regiment"]);
  });

  it("says when nothing is training", () => {
    show({ kind: "recruitment" });
    expect(screen.getByText(/^Nothing is training\./u)).toBeTruthy();
    expect(document.querySelector(".queue-summary-spend")).toBeNull();
  });
});

describe("Global Building (U9)", () => {
  it("lists queues by territory and sub-territory, marks contested ones paused, cancels a planned build and opens a sub-territory's card", async () => {
    let state = withSite(start, "madrid", { queue: [item(1)] });
    state = withSite(state, "granada", { holder: republic, queue: [item(0)] });
    const draft: Draft = { ...emptyDraft, builds: [{ factionId: republic, kind: "build", project: fortifications, subTerritoryId: sub("barcelona") }] };
    const { store, user } = show({ kind: "building" }, state, draft);
    expect(document.querySelector(".queue-summary")?.textContent).toBe("2 under way0 queued1 pausedMadrid finishes at the end of this turn");
    expect(screen.getByRole("list", { name: "Madrid build queue" })).toHaveTextContent("1 turn left");
    const andalucia = screen.getByRole("list", { name: "Granada build queue" }).closest("li.queue-group") as HTMLElement;
    expect(within(andalucia).getByText("Paused · contested")).toBeTruthy();
    expect(within(andalucia).getByRole("list", { name: "Granada build queue" })).toHaveTextContent("2 turns left when it resumes");
    const barcelona = screen.getByRole("list", { name: "Barcelona build queue" });
    expect(barcelona).toHaveTextContent("starts this turn");
    await user.click(within(barcelona).getByRole("button", { name: "Cancel Fortifications" }));
    expect(draftOf(store).builds).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Madrid" }));
    expect(store.getState().pane.stack.at(-1)).toEqual({ kind: "build", subTerritory: sub("madrid"), territory: territory("madrid") });
  });

  it("names two finishing territories, and says when nothing is being built", () => {
    let state = withSite(start, "madrid", { queue: [item(1)] });
    state = withSite(state, "barcelona", { queue: [item(1), item(0)] });
    show({ kind: "building" }, state);
    expect(document.querySelector(".queue-summary")?.textContent).toBe("2 under way1 queuedMadrid and Cataluña finish at the end of this turn");
    expect(screen.getAllByText("1 site")).toHaveLength(2);
    cleanup();
    show({ kind: "building" });
    expect(screen.getByText(/^Nothing is being built\./u)).toBeTruthy();
  });
});

describe("Build and Recruit views (U9)", () => {
  it("open Territory Info on Buildings with the named card open, and on Recruit with the training queue", () => {
    show({ kind: "build", subTerritory: sub("henares"), territory: territory("madrid") });
    expect(screen.getByRole("tab", { name: /^Buildings/u })).toHaveAttribute("aria-selected", "true");
    expect(within(screen.getByRole("article", { name: "Henares" })).getByRole("button", { expanded: true })).toBeTruthy();
    expect(within(screen.getByRole("article", { name: "Madrid" })).getByRole("button", { expanded: false })).toBeTruthy();
    cleanup();
    const state: GameState = { ...start, training: [{ factionId: republic, paid: {}, paused: true, territoryId: territory("madrid"), turnsLeft: 2, typeId: "infantry-regiment" as UnitTypeId, unitId: "t" as never }] };
    show({ kind: "recruit", territory: territory("madrid") }, state);
    expect(screen.getByRole("tab", { name: /^Recruit/u })).toHaveAttribute("aria-selected", "true");
    const queue = screen.getByRole("list", { name: "Madrid training" });
    expect(queue).toHaveAttribute("data-paused", "true");
    expect(queue.closest(".recruit-queue")?.textContent).toContain("Paused · contested");
  });

  it("opens Territory Info on the tab a territory view names", () => {
    show({ id: territory("madrid"), kind: "territory", tab: "production" });
    expect(screen.getByRole("tab", { name: "Production" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("the Production tab (U9)", () => {
  const tab = (state: GameState, where: string) => {
    const session: PlanningSession = { draft: emptyDraft, factionId: republic, game: { assignments: {}, history: [], locked: {}, scenarioId: spainId, seed: 1, state }, phase: "planning" };
    return render(<Provider store={testStore({ game: { session } })}><ProductionTab scenario={scenario} session={session} territoryId={territory(where)} /></Provider>);
  };

  it("shows each sub-territory's yield by resource and what the territory pays held whole", () => {
    tab({ ...start, raidCuts: [{ factionId: republic, subTerritoryId: sub("henares"), turnNumber: start.turnNumber }] }, "madrid");
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Sub-territory", ...scenario.resources.map((resource) => resource.name)]);
    const rows = within(table).getAllByRole("row");
    expect(rows[1]?.textContent).toMatch(/^★ MadridFarms 1 · Factory 1/u);
    expect(rows[2]?.textContent).toMatch(/^Sierra de GuadarramaNo development−−$/u);
    expect(rows[3]?.textContent).toContain("raided this turn");
    expect(rows.at(-1)?.textContent).toMatch(/^Held whole: pays\+/u);
    expect(screen.getByText(/comes from .* A raid on a sub-territory cuts its yield for a turn\.$/u)).toBeTruthy();
  });

  it("names other holders and strikes the total of a contested territory", () => {
    tab(start, "andalucia");
    expect(screen.getAllByText(/held by Southern Insurgent Command/u).length).toBeGreaterThan(0);
    const total = screen.getAllByRole("row").at(-1)!;
    expect(total).toHaveAttribute("data-contested", "true");
    expect(total.textContent).toMatch(/^Contested: pays nothing/u);
    expect(total.querySelectorAll("s").length).toBe(scenario.resources.length);
  });
});
