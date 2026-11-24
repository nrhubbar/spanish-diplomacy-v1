import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../main/app";
import { raisedUnitId } from "../main/engine/recruitment/rules";
import { initialGameState } from "../main/engine/resolution";
import type { GameState, UnitTypeId } from "../main/engine/types";
import { RegistryContext } from "../main/hooks";
import { paths } from "../main/state/routing";
import { emptyDraft } from "../main/state/session";
import { faction, spain, spainId, clickTerritoryIn, territory, testRegistry, testStore } from "./support";

afterEach(cleanup);

const republic = faction("republic");

function renderPlanning(state: GameState) {
  const game = { assignments: { [republic]: "local-human" as const }, history: [], locked: {}, scenarioId: spainId, seed: 1, state };
  const store = testStore({ game: { session: { draft: emptyDraft, factionId: republic, game, phase: "planning" } } });
  const user = userEvent.setup();
  render(
    <Provider store={store}>
      <RegistryContext value={testRegistry()}>
        <MemoryRouter initialEntries={[paths.orders]}>
          <App />
        </MemoryRouter>
      </RegistryContext>
    </Provider>
  );
  return { store, user };
}

describe("the Recruit tab and the Replenish order (X4, X7)", () => {
  const start = initialGameState(spain());
  const worn = Object.values(start.units).find((unit) => unit.factionId === republic && unit.territoryId === "catalunya")!;
  const trainingId = raisedUnitId(republic, "infantry-regiment" as UnitTypeId, 1);
  const state: GameState = {
    ...start,
    // Turn 2: the Briefing opens by itself only on turn 1.
    turnNumber: 2,
    training: [{ factionId: republic, paid: {}, paused: false, territoryId: territory("catalunya"), turnsLeft: 2, typeId: "infantry-regiment" as UnitTypeId, unitId: trainingId }],
    units: { ...start.units, [worn.id]: { ...worn, strength: Math.round(worn.strength / 2) } }
  };

  it("offers Replenish first with its men, cost and cancel rule, and plans it", async () => {
    const { store, user } = renderPlanning(state);
    act(() => { clickTerritoryIn(store, "catalunya"); });
    // Select only the worn unit.
    await user.click(await screen.findByRole("button", { name: "Clear" }));
    const pane = screen.getByRole("tabpanel");
    const row = within(pane).getAllByRole("button").find((button) => button.classList.contains("formation-button") && button.textContent.includes("men") && button.textContent.includes(String(Math.round(worn.strength / 2))));
    await user.click(row!);
    const menu = screen.getByRole("group", { name: "Orders for the selected units" });
    const choices = within(menu).getAllByRole("button").map((button) => button.textContent);
    expect(choices[0]).toBe("Replenish");
    expect(menu.textContent).toMatch(/\+\d+ men, arriving at the end of the turn/u);
    expect(menu.textContent).toMatch(/cancelled and refunded if the unit fights/u);
    await user.click(within(menu).getByRole("button", { name: "Replenish" }));
    expect(screen.getByRole("status")).toHaveTextContent("1 unit will replenish.");
    expect(screen.getByText(/Replenishing \(\+\d+ men\)/u)).toBeTruthy();
    // U9: the unit in training is in the Recruit tab's queue, with its bar.
    await user.click(screen.getByRole("tab", { name: /^Recruit/u }));
    expect(within(screen.getByRole("list", { name: "Barcelona training" })).getByRole("progressbar", { name: "Infantry regiment progress" })).toBeTruthy();
  });

  it("lists every recruitable type with locks said inline, and fills the basket", async () => {
    const { store, user } = renderPlanning(state);
    act(() => { clickTerritoryIn(store, "catalunya"); });
    await user.click(await screen.findByRole("tab", { name: /^Recruit/u }));
    expect(screen.getByText("Recruit at Barcelona")).toBeTruthy();
    expect(screen.getAllByText(/Not raised by the Republican Government/u).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "One more Militia column" }));
    expect(screen.getByText(/This turn: 3 Funds, 3k Manpower/u)).toBeTruthy();
    const session = store.getState().game.session;
    expect(session.phase === "planning" ? session.draft.recruits?.length : 0).toBe(1);
  });

  it("says why a site is closed: contested ground", async () => {
    const poor: GameState = { ...state, treasuries: { ...state.treasuries, [republic]: { funds: 9, manpower: 30 } as never } };
    const { store, user } = renderPlanning(poor);
    // Pais Vasco is contested from turn 1 (Alava is the North's): the site note locks every row.
    act(() => { clickTerritoryIn(store, "pais-vasco"); });
    await user.click(await screen.findByRole("tab", { name: /^Recruit/u }));
    expect(screen.getByRole("note").textContent).toMatch(/contested/u);
    expect(screen.queryByRole("button", { name: "One more Militia column" })).toBeNull();
  });

  it("says why a type is closed: full slots and a short balance", async () => {
    const poor: GameState = { ...state, treasuries: { ...state.treasuries, [republic]: { funds: 9, manpower: 30 } as never } };
    const again = renderPlanning(poor);
    act(() => { clickTerritoryIn(again.store, "madrid"); });
    await again.user.click(await screen.findByRole("tab", { name: /^Recruit/u }));
    expect(screen.getByText("0 of 3 Recruit orders here this turn")).toBeTruthy();
    // 9 Funds: one infantry regiment (5) leaves too little for a second, and three militia columns (3 each) take it all.
    await again.user.click(screen.getByRole("button", { name: "One more Infantry regiment" }));
    expect(screen.getByRole("button", { name: "One more Infantry regiment" }).getAttribute("title")).toBe("Not enough Funds.");
    await again.user.click(screen.getByRole("button", { name: "One fewer Infantry regiment" }));
    for (let index = 0; index < 3; index += 1) await again.user.click(screen.getByRole("button", { name: "One more Militia column" }));
    expect(screen.getByText("3 of 3 Recruit orders here this turn")).toBeTruthy();
    expect(screen.getByRole("button", { name: "One more Militia column" }).getAttribute("title")).toBe("No Recruit orders left here this turn.");
    expect(screen.getByText(/Left: 21k Manpower/u)).toBeTruthy();
  });
});
