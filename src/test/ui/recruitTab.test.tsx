import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it } from "vitest";
import { initialGameState } from "../../main/engine/resolution";
import type { BuildingId, GameState, RecruitOrder, Scenario, SubTerritoryId, TerritoryId, UnitTypeId } from "../../main/engine/types";
import { RegistryContext } from "../../main/hooks";
import { RecruitTab } from "../../main/screens/pane/RecruitTab";
import type { PlanningSession } from "../../main/state/planning";
import { emptyDraft, type Draft } from "../../main/state/session";
import { faction, spain, spainId, territory, testRegistry, testStore } from "../support";

afterEach(cleanup);

const republic = faction("republic");
const type = (id: string): UnitTypeId => id as UnitTypeId;

function session(state: GameState, draft: Draft = emptyDraft): PlanningSession {
  return { draft, factionId: republic, game: { assignments: { [republic]: "local-human" }, history: [], locked: {}, scenarioId: spainId, seed: 1, state }, phase: "planning" };
}

function renderTab(planning: PlanningSession, territoryId: TerritoryId, scenario: Scenario = spain()) {
  const store = testStore({ game: { session: planning } });
  const user = userEvent.setup();
  render(
    <Provider store={store}>
      <RegistryContext value={testRegistry()}>
        <RecruitTab scenario={scenario} session={planning} territoryId={territoryId} />
      </RegistryContext>
    </Provider>
  );
  return { store, user };
}

const row = (name: string): HTMLElement => {
  const found = screen.getAllByRole("listitem").find((item) => item.querySelector(".recruit-name")?.textContent === name);
  if (found === undefined) throw new Error(name);
  return found;
};

const recruit = (territoryId: string, unitTypeId: string): RecruitOrder => ({ factionId: republic, kind: "recruit", territoryId: territory(territoryId), unitTypeId: type(unitTypeId) });

function withCapital(state: GameState, id: string, buildings: readonly string[]): GameState {
  const before = state.subTerritories[id as SubTerritoryId];
  if (before === undefined) throw new Error(id);
  return { ...state, subTerritories: { ...state.subTerritories, [id]: { ...before, buildings: buildings as readonly BuildingId[] } } };
}

/** A state whose territory has no Factory, so two Recruit orders a turn and what needs one is locked. */
function withoutFactory(state: GameState, id: string): GameState {
  const before = state.subTerritories[id as SubTerritoryId];
  if (before === undefined) throw new Error(id);
  return { ...state, subTerritories: { ...state.subTerritories, [id]: { ...before, development: { ...before.development, factory: 0 } as GameState["subTerritories"][SubTerritoryId]["development"] } } };
}

describe("the Recruit tab (X4)", () => {
  const start = initialGameState(spain());

  it("heads the list with the capital and its buildings, and counts the orders left", () => {
    renderTab(session(start), territory("madrid"));
    expect(screen.getByRole("heading", { name: "Recruit at Madrid" })).toBeTruthy();
    expect(screen.getByTitle("What this territory recruits with").textContent).toMatch(/^Barracks \u00b7 .*Depot/u);
    expect(screen.getByText("0 of 3 Recruit orders here this turn")).toBeTruthy();
    const list = screen.getByRole("list", { name: "Recruit at Madrid" });
    expect(list.querySelectorAll(":scope > li").length).toBe(12);
    expect(screen.getByText(/^This turn: /u)).toBeTruthy();
    expect(screen.getByText(/^Left: 40 Funds, 10k? Manpower$/u)).toBeTruthy();
  });

  it("shows an open type's cost, men and training, with its buildings ticked", () => {
    renderTab(session(start), territory("madrid"));
    const militia = row("Militia column");
    expect(militia).toHaveAttribute("data-locked", "false");
    expect(militia).not.toHaveAttribute("tabindex");
    expect(within(militia).getByTitle("Attack-defence at full strength").textContent).toMatch(/^\d+-\d+$/u);
    expect(militia.querySelector(".recruit-meta")?.textContent).toMatch(/^3 Funds \u00b7 3k? Manpower \u00b7 2.5k men \u00b7 1 turn \u00b7 upkeep 1.5k Manpower$/u);
    expect(within(militia).getByRole("tooltip").textContent).toContain("Needs no buildings.");
    expect(within(militia).getByRole("button", { name: "One fewer Militia column" })).toBeDisabled();
    expect(within(militia).getByRole("button", { name: "One more Militia column" })).toBeEnabled();
    const infantry = row("Infantry regiment");
    expect(infantry.querySelector(".recruit-meta")?.textContent).toMatch(/700 men \u00b7 2 turns \u00b7 upkeep 0.25k Manpower$/u);
    expect(within(infantry).getByRole("tooltip").textContent).toContain("Needs: Barracks \u2713");
  });

  it("folds a type's special effects away until asked for, and gives a type without any no fold-out", () => {
    renderTab(session(start), territory("madrid"));
    const artillery = row("Artillery group");
    const fold = artillery.querySelector("details")!;
    expect(fold).not.toHaveAttribute("open");
    expect(fold.querySelector("summary")?.textContent).toBe("Special effects of the Artillery group");
    expect([...fold.querySelectorAll("li")].map((line) => line.textContent)).toEqual([expect.stringMatching(/artillery attack points/u), expect.stringMatching(/^Can't attack alone/u)]);
    expect(row("Infantry regiment").querySelector("details")).toBeNull();
  });

  it("says why a type is locked, inline and in the details", () => {
    renderTab(session(start), territory("madrid"));
    const veterans = row("Colonial veterans");
    expect(veterans).toHaveAttribute("data-locked", "true");
    expect(veterans).toHaveAttribute("tabindex", "0");
    expect(veterans.querySelector(".recruit-lock")?.textContent).toMatch(/Not raised by the Republican Government\./u);
    expect(within(veterans).queryByRole("group")).toBeNull();
    const details = within(veterans).getByRole("tooltip");
    expect(details.querySelector("strong")?.textContent).toBe("Colonial veterans: locked");
  });

  it("ticks the buildings a capital has and crosses the ones it lacks", () => {
    renderTab(session(withoutFactory(start, "cantabria")), territory("cantabria"));
    expect(screen.getByRole("heading", { name: "Recruit at Cantabria" })).toBeTruthy();
    const artillery = row("Artillery group");
    expect(artillery).toHaveAttribute("data-locked", "true");
    expect(within(artillery).getByRole("tooltip").textContent).toContain("Needs: Barracks \u2713, Factory \u00d7");
    expect(artillery.querySelector(".recruit-lock")?.textContent).toMatch(/Needs a Factory in Cantabria\./u);
    expect(screen.getByText("0 of 2 Recruit orders here this turn")).toBeTruthy();
  });

  it("names only the Factory where the capital has no buildings, and an unknown building by its id", () => {
    renderTab(session(withCapital(start, "cantabria", [])), territory("cantabria"));
    expect(screen.getByTitle("What this territory recruits with").textContent).toBe("Factory");
    cleanup();
    renderTab(session(withCapital(start, "cantabria", ["barracks", "secret-works"])), territory("cantabria"));
    expect(screen.getByTitle("What this territory recruits with").textContent).toBe("Barracks \u00b7 secret-works \u00b7 Factory");
  });

  it("locks every type with the site's problem where the faction cannot recruit", () => {
    renderTab(session(start), territory("navarra"));
    expect(screen.getByRole("note").textContent).toBe("You must hold Navarra to recruit there.");
    expect(screen.queryByText(/Recruit orders here this turn/u)).toBeNull();
    const militia = row("Militia column");
    expect(militia).toHaveAttribute("data-locked", "true");
    expect(militia.querySelector(".recruit-lock")?.textContent).toContain("You must hold Navarra to recruit there.");
    expect(screen.queryAllByRole("group", { name: /to recruit$/u })).toHaveLength(0);
  });

  it("disables adding once the territory's orders are used, and says so", () => {
    const full = session(withoutFactory(start, "cantabria"), { ...emptyDraft, recruits: [recruit("cantabria", "militia-column"), recruit("cantabria", "militia-column")] });
    renderTab(full, territory("cantabria"));
    expect(screen.getByText("2 of 2 Recruit orders here this turn")).toBeTruthy();
    const militia = row("Militia column");
    expect(within(militia).getByRole("group", { name: "Militia column to recruit" }).querySelector("output")?.textContent).toBe("2");
    const more = within(militia).getByRole("button", { name: "One more Militia column" });
    expect(more).toBeDisabled();
    expect(more).toHaveAttribute("title", "No Recruit orders left here this turn.");
    expect(within(militia).getByRole("button", { name: "One fewer Militia column" })).toBeEnabled();
    expect(within(militia).getByRole("tooltip").textContent).toContain("No Recruit orders left here this turn.");
    expect(screen.getByText(/^This turn: 6 Funds, 6k? Manpower$/u)).toBeTruthy();
  });

  it("disables adding what the treasury cannot pay, naming the resource", () => {
    const poor: GameState = { ...start, treasuries: { ...start.treasuries, [republic]: { funds: 1, manpower: 10 } } };
    renderTab(session(poor), territory("madrid"));
    const militia = row("Militia column");
    const more = within(militia).getByRole("button", { name: "One more Militia column" });
    expect(more).toBeDisabled();
    expect(more).toHaveAttribute("title", "Not enough Funds.");
  });

  it("adds and removes a unit through the store", async () => {
    const planning = session(start, { ...emptyDraft, recruits: [recruit("madrid", "militia-column")] });
    const { store, user } = renderTab(planning, territory("madrid"));
    await user.click(screen.getByRole("button", { name: "One more Infantry regiment" }));
    const added = store.getState().game.session;
    expect(added.phase === "planning" ? added.draft.recruits?.map((order) => order.unitTypeId) : []).toEqual(["militia-column", "infantry-regiment"]);
    await user.click(screen.getByRole("button", { name: "One fewer Militia column" }));
    const removed = store.getState().game.session;
    expect(removed.phase === "planning" ? removed.draft.recruits?.map((order) => order.unitTypeId) : []).toEqual(["infantry-regiment"]);
  });

  it("heads a territory without a capital with its own name", () => {
    const scenario = spain();
    const noCapital: Scenario = {
      ...scenario,
      index: {
        ...scenario.index,
        territories: new Map([...scenario.index.territories].map(([id, entry]) => {
          if (id !== territory("cantabria")) return [id, entry];
          const copy = { ...entry };
          delete (copy as { capitalSubTerritoryId?: unknown }).capitalSubTerritoryId;
          return [id, copy];
        }))
      }
    };
    renderTab(session(start), territory("cantabria"), noCapital);
    expect(screen.getByRole("heading", { name: "Recruit at Cantabria" })).toBeTruthy();
    expect(screen.getByTitle("What this territory recruits with").textContent).toBe("Factory");
  });
});
