import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it } from "vitest";
import { initialGameState } from "../../main/engine/resolution";
import type { BuildingId, BuildOrder, BuildProject, DevelopmentId, GameState, QueueItem, Scenario, SubTerritoryId, SubTerritoryState } from "../../main/engine/types";
import { RegistryContext } from "../../main/hooks";
import { BuildList } from "../../main/screens/pane/build/BuildList";
import { Pips, SiteCard } from "../../main/screens/pane/build/SiteCard";
import { SubTerritoryFocus } from "../../main/screens/pane/SubTerritoryFocus";
import type { PlanningSession } from "../../main/state/planning";
import { emptyDraft, type Draft } from "../../main/state/session";
import { faction, spain, spainId, spainM2, testRegistry, testStore } from "../support";

afterEach(cleanup);

const republic = faction("republic");
const sub = (id: string): SubTerritoryId => id as SubTerritoryId;
const building = (id: string): BuildProject => ({ buildingId: id as BuildingId, kind: "building" });
const development = (id: string): BuildProject => ({ developmentId: id as DevelopmentId, kind: "development" });
const item = (project: BuildProject, progress = 0, paid: Readonly<Record<string, number>> = { funds: 6 }): QueueItem => ({ factionId: republic, paid: paid, project, progress });

function planning(state: GameState, draft: Draft = emptyDraft): PlanningSession {
  return { draft, factionId: republic, game: { assignments: { [republic]: "local-human" }, history: [], locked: {}, scenarioId: spainId, seed: 1, state }, phase: "planning" };
}

function withSite(state: GameState, id: string, change: Partial<SubTerritoryState>): GameState {
  const before = state.subTerritories[sub(id)];
  if (before === undefined) throw new Error(id);
  return { ...state, subTerritories: { ...state.subTerritories, [sub(id)]: { ...before, ...change } } };
}

function renderIn(session: PlanningSession, node: React.ReactNode) {
  const store = testStore({ game: { session } });
  const user = userEvent.setup();
  render(<Provider store={store}><RegistryContext value={testRegistry()}>{node}</RegistryContext></Provider>);
  return { store, user };
}

const draftOf = (store: ReturnType<typeof testStore>): Draft | undefined => {
  const session = store.getState().game.session;
  return session.phase === "planning" ? session.draft : undefined;
};

describe("level pips", () => {
  it("fills squares up to the level", () => {
    render(<Pips label="Farms" level={2} max={3} />);
    const pips = screen.getByRole("img", { name: "Farms level 2 of 3" });
    expect(pips.querySelectorAll(".pip")).toHaveLength(3);
    expect(pips.querySelectorAll(".pip-full")).toHaveLength(2);
  });
});

describe("the site card (X7)", () => {
  const scenario = spain();
  const start = initialGameState(scenario);

  const card = (state: GameState, id: string, props: { readonly planned?: readonly { readonly index: number; readonly order: BuildOrder }[]; readonly scenario?: Scenario; readonly withBuildButton?: boolean } = {}) =>
    renderIn(planning(state), <SiteCard planned={props.planned ?? []} scenario={props.scenario ?? scenario} state={state} subTerritoryId={sub(id)} viewer={republic} withBuildButton={props.withBuildButton ?? true} />);

  it("shows an own capital: star, yield, levels, buildings and the Build button", async () => {
    const { store, user } = card(start, "madrid");
    const article = screen.getByRole("article", { name: "Madrid" });
    expect(article).toHaveClass("site-card-own");
    expect(within(article).getByRole("heading").textContent).toBe("Madrid (capital)");
    expect(article.querySelector(".site-yield")?.textContent).toMatch(/^\+/u);
    expect(article.querySelector(".site-holder")).toBeNull();
    const levels = within(article).getByRole("list", { name: "Development and improvements" });
    expect(within(levels).getByRole("img", { name: /^Industry level 2 of \d+$/u })).toBeTruthy();
    expect(within(levels).getByRole("img", { name: /^Rail level 3 of \d+$/u })).toBeTruthy();
    expect(within(levels).queryByText("Port")).toBeNull();
    expect(within(within(article).getByRole("list", { name: "Buildings" })).getByText("Factory")).toBeTruthy();
    expect(within(article).queryByRole("list", { name: "Build queue" })).toBeNull();
    expect(within(article).queryByText("Queue hidden")).toBeNull();
    await user.click(within(article).getByRole("button", { name: "Build in Madrid" }));
    expect(draftOf(store)?.focusedSubTerritoryId).toBe("madrid");
  });

  it("hides another faction's queue and names its holder", () => {
    card(start, "burgos");
    const article = screen.getByRole("article", { name: "Burgos" });
    expect(article).not.toHaveClass("site-card-own");
    expect(article.querySelector(".site-holder")?.textContent).toMatch(/^Held by /u);
    expect(within(article).getByText("Queue hidden")).toBeTruthy();
    expect(within(article).queryByRole("button", { name: /^Build in/u })).toBeNull();
  });

  it("leaves out city-only tracks without a city, shows a port, and says when nothing is yielded", () => {
    const barren = withSite(start, "guadarrama", { buildings: [], development: {}, port: 2 });
    card(barren, "guadarrama");
    const article = screen.getByRole("article", { name: "Sierra de Guadarrama" });
    expect(within(article).getByRole("heading").textContent).toBe("Sierra de Guadarrama");
    expect(article.querySelector(".site-yield")?.textContent).toBe("no yield");
    expect(within(article).queryByText("Industry")).toBeNull();
    expect(within(article).getByRole("img", { name: /^Port level 2 of \d+$/u })).toBeTruthy();
    expect(within(article).getByRole("img", { name: /^Farms level 0 of \d+$/u })).toBeTruthy();
    expect(within(article).queryByRole("list", { name: "Buildings" })).toBeNull();
  });

  it("skips unknown buildings, and draws no improvements without them", () => {
    const state = withSite(start, "madrid", { buildings: ["barracks", "mystery"] as BuildingId[] });
    const bare = { ...scenario };
    delete (bare as { improvements?: unknown }).improvements;
    card(state, "madrid", { scenario: bare, withBuildButton: false });
    const article = screen.getByRole("article", { name: "Madrid" });
    expect(within(within(article).getByRole("list", { name: "Buildings" })).getAllByRole("listitem").map((entry) => entry.textContent)).toEqual(["Barracks"]);
    expect(within(article).queryByText("Rail")).toBeNull();
    expect(within(article).queryByRole("button", { name: /^Build in/u })).toBeNull();
  });

  it("lists the queue: the head with its turns left, queued items, this turn's plans and progress", async () => {
    const queue = [item(development("farms"), 1), item(development("farms"), 0, { funds: 6 }), item(building("fortifications"), 0, { funds: 4 }), item(building("mystery"), 0, {})];
    const state = withSite(start, "madrid", { queue });
    const plannedOrder: BuildOrder = { factionId: republic, kind: "build", project: building("mystery"), subTerritoryId: sub("madrid") };
    const { store, user } = card(state, "madrid", { planned: [{ index: 4, order: plannedOrder }] });
    const list = screen.getByRole("list", { name: "Build queue" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveClass("queue-head");
    expect(rows[0]?.querySelector("strong")?.textContent).toBe("Farms 1 \u2192 2");
    expect(rows[0]?.querySelector(".queue-status")?.textContent).toBe("2 turns left");
    expect(within(rows[0]!).getByRole("progressbar", { name: "Farms 1 \u2192 2 progress" })).toHaveAttribute("aria-valuenow", "1");
    expect(rows[1]).toHaveClass("queue-next");
    expect(rows[1]?.textContent).toMatch(/^Next: Farms 2 \u2192 3/u);
    expect(rows[1]?.querySelector(".queue-status")?.textContent).toBe("queued \u00b7 6 Funds");
    expect(rows[2]?.querySelector("strong")?.textContent).toBe("Fortifications");
    expect(rows[3]?.querySelector(".queue-status")?.textContent).toBe("this turn \u00b7 nothing");
    expect(within(rows[3]!).getByRole("progressbar")).toHaveAttribute("aria-valuemax", "1");
    await user.click(within(rows[3]!).getByRole("button", { name: "Cancel mystery" }));
    // Cancelling an order the draft does not have leaves the plan as it was.
    expect(draftOf(store)?.builds ?? []).toEqual([]);
  });

  it("draws nothing for an unknown sub-territory or a missing site", () => {
    card(start, "atlantis");
    expect(screen.queryByRole("article")).toBeNull();
    cleanup();
    const missing = { ...start, subTerritories: { ...start.subTerritories } };
    delete (missing.subTerritories as Record<string, unknown>)["madrid"];
    card(missing, "madrid");
    expect(screen.queryByRole("article")).toBeNull();
  });
});

describe("the sub-territory focus (X3)", () => {
  const scenario = spain();
  const start = initialGameState(scenario);

  const focus = (state: GameState, id: string, given: Scenario = scenario) =>
    renderIn(planning(state, { ...emptyDraft, focusedSubTerritoryId: sub(id) }), <SubTerritoryFocus factionId={republic} scenario={given} state={state} subTerritoryId={sub(id)} />);

  it("names a capital, its holder, terrain, rail and cities, and goes back to the territory", async () => {
    const { store, user } = focus(start, "madrid");
    const pane = document.querySelector("[data-sub-territory-id='madrid']")!;
    expect(pane.querySelector(".capital-star")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 3 }).textContent).toMatch(/Madrid$/u);
    expect(screen.getByText(/^Capital sub-territory of Madrid \u00b7 held by /u)).toBeTruthy();
    const chips = within(screen.getByRole("list", { name: "About this sub-territory" })).getAllByRole("listitem").map((chip) => chip.textContent);
    expect(chips).toEqual(["Open ground", "Rail 3"]);
    expect(screen.getByText(/^Cities: /u)).toBeTruthy();
    expect(screen.queryByText(/is contested/u)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Back to Madrid" }));
    expect(draftOf(store)?.focusedSubTerritoryId).toBeUndefined();
  });

  it("marks contested ground, a coast and mountains", () => {
    const coastal = withSite(start, "granada", { port: 1, rail: 0 });
    focus(coastal, "granada");
    expect(screen.getByText(/^Sub-territory of Andaluc\u00eda \u00b7 held by /u)).toBeTruthy();
    const chips = within(screen.getByRole("list", { name: "About this sub-territory" })).getAllByRole("listitem").map((chip) => chip.textContent);
    expect(chips).toEqual(["Mountains", "Coast \u00b7 port 1", "Contested ground"]);
    expect(screen.getByText(/^Andaluc\u00eda is contested: it pays no income/u)).toBeTruthy();
  });

  it("falls back to the scenario's start for a sub-territory with no state, and names a marsh", () => {
    const missing = { ...start, subTerritories: { ...start.subTerritories } };
    delete (missing.subTerritories as Record<string, unknown>)["henares"];
    const marshy: Scenario = { ...scenario, index: { ...scenario.index, subTerritories: new Map([...scenario.index.subTerritories].map(([id, entry]) => [id, id === sub("henares") ? { ...entry, terrain: "swamp" as const } : entry])) } };
    focus(missing, "henares", marshy);
    expect(screen.getByText(/^Sub-territory of Madrid \u00b7 held by /u)).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "About this sub-territory" })).getAllByRole("listitem")[0]?.textContent).toBe("Marsh");
    expect(screen.queryByRole("article")).toBeNull();
  });

  it("draws nothing for an unknown sub-territory", () => {
    focus(start, "atlantis");
    expect(document.querySelector(".sub-territory-focus")).toBeNull();
  });
});

describe("the build list ($4, $5)", () => {
  const scenario = spain();
  const start = initialGameState(scenario);

  const list = (state: GameState, id: string, given: Scenario = scenario, draft: Draft = emptyDraft) =>
    renderIn(planning(state, draft), <BuildList scenario={given} subTerritoryId={sub(id)} />);

  it("offers the projects that can be queued first, then the locked ones with their reasons", async () => {
    const { store, user } = list(start, "madrid");
    const options = within(screen.getByRole("region", { name: "Add to the queue" })).getAllByRole("listitem");
    expect(options.length).toBeGreaterThan(3);
    const firstLocked = options.findIndex((option) => option.classList.contains("build-option-locked"));
    expect(firstLocked).toBeGreaterThan(0);
    expect(options.slice(firstLocked).every((option) => option.classList.contains("build-option-locked"))).toBe(true);
    expect(options[firstLocked]?.querySelector(".build-locked")?.textContent).toMatch(/\S/u);
    expect(within(options[firstLocked]!).queryByRole("button")).toBeNull();
    // A capital with a city is offered city-only tracks.
    expect(options.some((option) => option.querySelector("strong")?.textContent.startsWith("Industry") === true)).toBe(true);
    const queue = within(options[0]!).getByRole("button", { name: /^Queue /u });
    await user.click(queue);
    expect(draftOf(store)?.builds).toHaveLength(1);
  });

  it("leaves out city-only and capital-only projects where they can never be built", () => {
    const limited: Scenario = {
      ...scenario,
      index: {
        ...scenario.index,
        buildings: new Map([...scenario.index.buildings].map(([id, entry]) => [id, id === "barracks" ? { ...entry, capitalOnly: true } : id === "factory" ? { ...entry, cityOnly: true } : entry]))
      }
    };
    list(start, "guadarrama", limited);
    const names = within(screen.getByRole("region", { name: "Add to the queue" })).getAllByRole("listitem").map((option) => option.querySelector("strong")?.textContent ?? "");
    expect(names.some((name) => name.startsWith("Industry"))).toBe(false);
    expect(names).not.toContain("Barracks");
    expect(names).not.toContain("Factory");
    expect(names).toContain("Depot");
    cleanup();
    list(start, "madrid", limited);
    const capitalNames = within(screen.getByRole("region", { name: "Add to the queue" })).getAllByRole("listitem").map((option) => option.querySelector("strong")?.textContent ?? "");
    expect(capitalNames).toContain("Barracks");
    expect(capitalNames).toContain("Factory");
  });

  it("shows only the card for another faction's sub-territory", () => {
    list(start, "burgos");
    expect(screen.getByRole("article", { name: "Burgos" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Add to the queue" })).toBeNull();
  });

  it("draws nothing without the economy, without a site, or for an unknown sub-territory", () => {
    list(start, "madrid", { ...scenario, rules: { ...scenario.rules, economy: "none" } });
    expect(document.querySelector(".build-list")).toBeNull();
    cleanup();
    list(start, "atlantis");
    expect(document.querySelector(".build-list")).toBeNull();
    cleanup();
    const ghost = { ...start, subTerritories: { ...start.subTerritories, [sub("atlantis")]: start.subTerritories[sub("madrid")]! } };
    list(ghost, "atlantis");
    expect(document.querySelector(".build-list")).toBeNull();
  });

  it("shows a planned build as this turn's, with its Cancel", async () => {
    const order: BuildOrder = { factionId: republic, kind: "build", project: building("fortifications"), subTerritoryId: sub("madrid") };
    const { store, user } = list(start, "madrid", scenario, { ...emptyDraft, builds: [order] });
    const rows = within(screen.getByRole("list", { name: "Build queue" })).getAllByRole("listitem");
    expect(rows.at(-1)?.querySelector(".queue-status")?.textContent).toMatch(/^this turn \u00b7 \d+ Funds/u);
    await user.click(screen.getByRole("button", { name: "Cancel Fortifications" }));
    expect(draftOf(store)?.builds).toEqual([]);
  });

  it("is the same list without partition", () => {
    list(initialGameState(spainM2()), "madrid", spainM2());
    expect(screen.getByRole("region", { name: "Add to the queue" })).toBeTruthy();
  });
});
