import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it } from "vitest";
import { initialGameState } from "../../main/engine/resolution";
import type { BuildingId, GameState, RecruitOrder, Scenario, SubTerritoryId, TerritoryId, UnitTypeId } from "../../main/engine/types";
import { RegistryContext } from "../../main/hooks";
import { RecruitTab } from "../../main/screens/pane/RecruitTab";
import { OrderLedger } from "../../main/screens/queues/OrderLedger";
import type { PlanningSession } from "../../main/state/planning";
import { emptyDraft, type Draft } from "../../main/state/session";
import { faction, spain, spainId, territory, testRegistry, testStore, testGame } from "../support";

afterEach(cleanup);

const republic = faction("republic");
const type = (id: string): UnitTypeId => id as UnitTypeId;

function session(state: GameState, draft: Draft = emptyDraft): PlanningSession {
  return { draft, factionId: republic, game: { assignments: { [republic]: "local-human" }, history: [], ready: [], scenarioId: spainId, gameId: testGame, state }, phase: "planning" };
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

/** A card's figures as read out: "Cost: 5 Funds 1k Manpower". */
const terms = (card: HTMLElement): string => card.querySelector(".build-terms")?.textContent ?? "";
const means = (): readonly (string | null)[] => within(screen.getByRole("list", { name: "What this territory recruits with" })).getAllByRole("listitem").map((item) => item.textContent);

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
    expect(means().slice(0, 2)).toEqual(["Barracks", "Depot"]);
    expect(screen.getByText("0 of 3 Recruit orders here this turn")).toBeTruthy();
    const open = screen.getByRole("list", { name: "Can recruit now" }).querySelectorAll(":scope > li").length;
    const locked = screen.getByRole("list", { name: "Locked here" }).querySelectorAll(":scope > li").length;
    expect(open + locked).toBe(12);
    expect(screen.getByRole("region", { name: "In training" }).textContent).toContain("No unit is training here.");
    expect(screen.getByText(/^All recruiting and replenishing this turn: /u)).toBeTruthy();
    expect(screen.getByText(/^Left: 40 Funds, 10k? Manpower$/u)).toBeTruthy();
  });

  it("shows an open type's cost, men and training, with its buildings ticked", () => {
    renderTab(session(start), territory("madrid"));
    const militia = row("Militia column");
    expect(militia).toHaveAttribute("data-locked", "false");
    expect(militia).not.toHaveAttribute("tabindex");
    expect(within(militia).getByTitle("Attack-defence at full strength").textContent).toMatch(/^\d+-\d+$/u);
    expect(terms(militia)).toBe("4 Funds \u00b7 3k Manpower \u00b7 2.5k men \u00b7 1 turn \u00b7 upkeep 0.3 Funds and 1.5k Manpower");
    expect(within(militia).getByRole("tooltip").textContent).toContain("Needs no buildings.");
    expect(within(militia).getByRole("button", { name: "One fewer Militia column" })).toHaveAttribute("aria-disabled", "true");
    expect(within(militia).getByRole("button", { name: "One more Militia column" })).toHaveAttribute("aria-disabled", "false");
    const infantry = row("Infantry regiment");
    expect(terms(infantry)).toBe("6 Funds \u00b7 1k Manpower \u00b7 700 men \u00b7 2 turns \u00b7 upkeep 0.3 Funds and 0.3k Manpower");
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
    expect(veterans.querySelector(".build-locked")?.textContent).toMatch(/Not raised by the Republican Government\./u);
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
    expect(artillery.querySelector(".build-locked")?.textContent).toMatch(/Needs a Factory in Cantabria\./u);
    expect(screen.getByText("0 of 2 Recruit orders here this turn")).toBeTruthy();
  });

  it("names only the Factory where the capital has no buildings, and an unknown building by its id", () => {
    renderTab(session(withCapital(start, "cantabria", [])), territory("cantabria"));
    expect(means()).toEqual(["Factory"]);
    cleanup();
    renderTab(session(withCapital(start, "cantabria", ["barracks", "secret-works"])), territory("cantabria"));
    expect(means()).toEqual(["Barracks", "secret-works", "Factory"]);
    cleanup();
    renderTab(session(withCapital(withoutFactory(start, "cantabria"), "cantabria", [])), territory("cantabria"));
    expect(screen.getByText("No buildings")).toBeTruthy();
  });

  it("locks every type with the site's problem where the faction cannot recruit", () => {
    renderTab(session(start), territory("navarra"));
    expect(screen.getByRole("note").textContent).toBe("You must hold Navarra to recruit there.");
    expect(screen.queryByText(/Recruit orders here this turn/u)).toBeNull();
    const militia = row("Militia column");
    expect(militia).toHaveAttribute("data-locked", "true");
    expect(militia.querySelector(".build-locked")?.textContent).toContain("You must hold Navarra to recruit there.");
    expect(screen.queryAllByRole("group", { name: /to recruit$/u })).toHaveLength(0);
  });

  it("disables adding once the territory's orders are used, and says so", () => {
    const full = session(withoutFactory(start, "cantabria"), { ...emptyDraft, recruits: [recruit("cantabria", "militia-column"), recruit("cantabria", "militia-column")] });
    renderTab(full, territory("cantabria"));
    expect(screen.getByText("2 of 2 Recruit orders here this turn")).toBeTruthy();
    const militia = row("Militia column");
    expect(within(militia).getByRole("group", { name: "Militia column to recruit" }).querySelector("output")?.textContent).toBe("2");
    const more = within(militia).getByRole("button", { name: "One more Militia column" });
    expect(more).toHaveAttribute("aria-disabled", "true");
    expect(more).toHaveAttribute("title", "No Recruit orders left here this turn.");
    expect(more).toHaveAccessibleDescription("No Recruit orders left here this turn.");
    expect(militia.querySelector(".recruit-note")?.textContent).toBe("No orders left");
    expect(within(militia).getByRole("button", { name: "One fewer Militia column" })).toHaveAttribute("aria-disabled", "false");
    expect(within(militia).getByRole("tooltip").textContent).toContain("No Recruit orders left here this turn.");
    expect(screen.getByText(/^All recruiting and replenishing this turn: 8 Funds, 6k? Manpower$/u)).toBeTruthy();
  });

  it("disables adding what the treasury cannot pay, naming the resource", () => {
    const poor: GameState = { ...start, treasuries: { ...start.treasuries, [republic]: { funds: 1, manpower: 10 } } };
    renderTab(session(poor), territory("madrid"));
    const militia = row("Militia column");
    const more = within(militia).getByRole("button", { name: "One more Militia column" });
    expect(more).toHaveAttribute("aria-disabled", "true");
    expect(more).toHaveAttribute("title", "Not enough Funds.");
    expect(militia.querySelector(".recruit-note")?.textContent).toBe("Not enough Funds");
    expect(militia.querySelector('[data-short="true"]')?.textContent).toBe("4 Funds \u00b7 3k Manpower");
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

  it("ignores a press on a stepper that is off", async () => {
    const full = session(withoutFactory(start, "cantabria"), { ...emptyDraft, recruits: [recruit("cantabria", "militia-column"), recruit("cantabria", "militia-column")] });
    const { store, user } = renderTab(full, territory("cantabria"));
    await user.click(screen.getByRole("button", { name: "One more Militia column" }));
    expect(store.getState().game.session).toBe(full);
    cleanup();
    const none = session(start);
    const empty = renderTab(none, territory("madrid"));
    await empty.user.click(screen.getByRole("button", { name: "One fewer Militia column" }));
    expect(empty.store.getState().game.session).toBe(none);
  });

  it("keeps the lines of orders given where the territory can no longer recruit, so they can be taken back", async () => {
    const contested = session(start, { ...emptyDraft, recruits: [recruit("aragon", "militia-column")] });
    const { store, user } = renderTab(contested, territory("aragon"));
    expect(document.querySelector(".recruit-site-note")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: /^Cancel Militia column/u }));
    const after = store.getState().game.session;
    expect(after.phase === "planning" ? after.draft.recruits : undefined).toEqual([]);
  });

  it("draws a line for every order, given or empty, with its price, and cancels one", async () => {
    const planning = session(start, { ...emptyDraft, recruits: [recruit("madrid", "militia-column"), recruit("valencia", "militia-column"), recruit("madrid", "infantry-regiment")] });
    const { store, user } = renderTab(planning, territory("madrid"));
    const ledger = within(screen.getByRole("list", { name: "Recruit orders at Madrid" }));
    expect(ledger.getAllByRole("listitem").map((line) => line.textContent.replaceAll(/\s+/gu, " "))).toEqual(["Militia column4 Funds 3k Manpower Cancel", "Infantry regiment6 Funds 1k Manpower Cancel", "EmptyCancel"]);
    const slots = ledger.getAllByRole("button");
    expect(slots.map((slot) => slot.getAttribute("aria-label"))).toEqual(["Cancel Militia column, order 1 of 3", "Cancel Infantry regiment, order 2 of 3", "Nothing to cancel, order 3 of 3"]);
    expect(slots[2]).toHaveAttribute("tabindex", "-1");
    await user.click(slots[2]!);
    expect(store.getState().game.session).toBe(planning);
    await user.click(slots[0]!);
    const after = store.getState().game.session;
    expect(after.phase === "planning" ? after.draft.recruits?.map((order) => [order.territoryId, order.unitTypeId]) : []).toEqual([["valencia", "militia-column"], ["madrid", "infantry-regiment"]]);
  });

  it("names each line by its type, and counts orders beyond the territory's plainly", () => {
    const planning = session(start);
    render(
      <Provider store={testStore({ game: { session: planning } })}>
        <RegistryContext value={testRegistry()}>
          <OrderLedger label="Orders" onCancel={() => undefined} orders={[{ ...recruit("madrid", "infantry-regiment"), factionId: faction("nobody") }, recruit("madrid", "militia-column")]} scenario={spain()} slots={1} />
        </RegistryContext>
      </Provider>
    );
    expect(screen.getByRole("button", { name: "Cancel Infantry regiment, order 1 of 1" })).toBeTruthy();
    expect(screen.getByText("Infantry regiment")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel Militia column, order 2" })).toBeTruthy();
  });

  it("lists the units in training below the cards, others' by recon, without this turn's orders", () => {
    const item = (id: string, factionId = republic) => ({ factionId, paid: {}, paused: false, territoryId: territory("madrid"), turnsLeft: 1, typeId: type(id), unitId: `t-${id}` as never });
    const state: GameState = { ...start, training: [item("infantry-regiment"), item("zeppelin", faction("north"))] };
    renderTab(session(state, { ...emptyDraft, recruits: [recruit("madrid", "militia-column")] }), territory("madrid"));
    const rows = within(screen.getByRole("list", { name: "Madrid training" })).getAllByRole("listitem");
    expect(rows.map((entry) => entry.querySelector(".recruit-head")?.textContent)).toEqual(["Infantry regiment4-6", "Unknown unit (Northern Insurgent Command, recon)"]);
    expect(within(rows[0]!).getByRole("progressbar", { name: "Infantry regiment progress" })).toHaveAttribute("aria-valuenow", "1");
    expect(screen.queryByRole("button", { name: "Cancel Militia column" })).toBeNull();
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
    expect(means()).toEqual(["Factory"]);
  });
});
