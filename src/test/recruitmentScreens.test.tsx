import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../main/app";
import { raisedUnitId } from "../main/engine/recruitment/rules";
import { initialGameState } from "../main/engine/resolution";
import type { GameState, UnitTypeId } from "../main/engine/types";
import { RegistryContext } from "../main/hooks";
import { clickMapTerritory } from "../main/state/gameSlice";
import { paths } from "../main/state/routing";
import { emptyDraft } from "../main/state/session";
import { faction, spain, spainId, territory, testRegistry, testStore } from "./support";

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
    store.dispatch(clickMapTerritory(territory("catalunya")));
    // Select only the worn unit.
    await user.click(await screen.findByRole("button", { name: "Clear" }));
    const pane = screen.getByRole("tabpanel");
    const row = within(pane).getAllByRole("button").find((button) => button.classList.contains("formation-button") && button.textContent.includes("men") && button.textContent.includes(String(Math.round(worn.strength / 2))));
    await user.click(row!);
    await user.click(screen.getByRole("button", { name: /Give Selected Armies Order/u }));
    const menu = screen.getByRole("group", { name: /Order for/u });
    const choices = within(menu).getAllByRole("button").map((button) => button.textContent);
    expect(choices[0]).toBe("Replenish");
    expect(menu.textContent).toMatch(/\+\d+ men, arriving at the end of the turn/u);
    expect(menu.textContent).toMatch(/cancelled and refunded if the unit fights/u);
    await user.click(within(menu).getByRole("button", { name: "Replenish" }));
    expect(screen.getByText(/replenishing,/u)).toBeTruthy();
    expect(screen.getByText("In training")).toBeTruthy();
    expect(screen.getByText("Infantry regiment No. 1")).toBeTruthy();
  });

  it("lists every recruitable type with locks said inline, and fills the basket", async () => {
    const { store, user } = renderPlanning(state);
    store.dispatch(clickMapTerritory(territory("catalunya")));
    await user.click(await screen.findByRole("tab", { name: "Recruit" }));
    expect(screen.getByText("Recruit at Barcelona")).toBeTruthy();
    expect(screen.getAllByText(/Not raised by the Republican Government/u).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "One more Militia column" }));
    expect(screen.getByText(/This turn: 2 Funds, 3k Manpower/u)).toBeTruthy();
    const session = store.getState().game.session;
    expect(session.phase === "planning" ? session.draft.recruits?.length : 0).toBe(1);
  });

  it("says why a site or a type is closed: contested ground, full slots and a short balance", async () => {
    const poor: GameState = { ...state, treasuries: { ...state.treasuries, [republic]: { funds: 7, manpower: 30 } as never } };
    const { store, user } = renderPlanning(poor);
    // Pais Vasco is contested from turn 1 (Alava is the North's): the site note locks every row.
    store.dispatch(clickMapTerritory(territory("pais-vasco")));
    await user.click(await screen.findByRole("tab", { name: "Recruit" }));
    expect(screen.getByRole("note").textContent).toMatch(/contested/u);
    expect(screen.queryByRole("button", { name: "One more Militia column" })).toBeNull();
    cleanup();

    const again = renderPlanning(poor);
    again.store.dispatch(clickMapTerritory(territory("catalunya")));
    await again.user.click(await screen.findByRole("tab", { name: "Recruit" }));
    expect(screen.getByText("0 of 3 Recruit orders here this turn")).toBeTruthy();
    // 7 Funds: one infantry regiment (6) leaves too little for a second.
    await again.user.click(screen.getByRole("button", { name: "One more Infantry regiment" }));
    expect(screen.getByRole("button", { name: "One more Infantry regiment" }).getAttribute("title")).toBe("Not enough Funds.");
    await again.user.click(screen.getByRole("button", { name: "One fewer Infantry regiment" }));
    for (let index = 0; index < 3; index += 1) await again.user.click(screen.getByRole("button", { name: "One more Militia column" }));
    expect(screen.getByText("3 of 3 Recruit orders here this turn")).toBeTruthy();
    expect(screen.getByRole("button", { name: "One more Militia column" }).getAttribute("title")).toBe("No Recruit orders left here this turn.");
    expect(screen.getByText(/Left: 1 Funds/u)).toBeTruthy();
  });
});
