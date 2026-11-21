import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../main/app";
import { initialGameState } from "../main/engine/resolution";
import type { GameState, TurnOutcome, TurnResolutionResult } from "../main/engine/types";
import { victoryProgress } from "../main/engine/victory";
import { RegistryContext } from "../main/hooks";
import type { GameRecord, Session } from "../main/state/session";
import { spainShowcaseOutcomes } from "./battleFixtures";
import { armyIn, faction, move, spain, spainId, territory, testRegistry, testStore } from "./support";

function record(state: GameState): GameRecord {
  return {
    assignments: { [faction("republic")]: "local-human", [faction("north")]: "computer", [faction("south")]: "computer" },
    history: [],
    locked: {},
    scenarioId: spainId,
    seed: 1936,
    state
  };
}

function renderSession(session: Session, path: string) {
  const user = userEvent.setup();
  const store = testStore({ briefing: { autoOpenedFor: [faction("republic")] }, game: { session } });
  const view = render(
    <Provider store={store}>
      <RegistryContext value={testRegistry()}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </RegistryContext>
    </Provider>
  );
  return { user, view };
}

function resolution(outcomes: readonly TurnOutcome[]): Session {
  const scenario = spain();
  const state = initialGameState(scenario);
  const result: TurnResolutionResult = {
    cityChanges: [],
    controlChanges: [],
    subTerritoryChanges: [],
    finalState: state,
    outcomes,
    progress: victoryProgress(scenario, state),
    submittedOrders: []
  };
  return { game: record(state), phase: "resolution", result };
}

/** Spain at turn 2 with Covadonga demoralized at half strength and Madrid dug in. */
function shakenMadrid(): GameState {
  const base = initialGameState(spain());
  const covadonga = armyIn(base, "rep-covadonga-4");
  return {
    ...base,
    fortification: { [territory("madrid")]: { factionId: faction("republic"), level: 2 } },
    turnNumber: 2,
    units: { ...base.units, [covadonga.id]: { ...covadonga, morale: { demoralized: true, quietTurns: 0 }, strength: 370 } }
  };
}

describe("turn report battle cards (C14)", () => {
  afterEach(cleanup);

  it("shows a summary, two open cards, and the rest collapsed", async () => {
    renderSession(resolution(spainShowcaseOutcomes()), "/resolution");
    await screen.findByRole("application", { name: /map/ });
    const report = screen.getByRole("complementary", { name: "Turn report" });
    expect(within(report).getByRole("heading", { name: "Battles" })).toBeVisible();
    expect(within(report).getByText(/^6 battles . 3 territories changed hands/)).toBeVisible();
    const cards = [...report.querySelectorAll("details.battle-card")];
    expect(cards.map((card) => card.hasAttribute("open"))).toEqual([true, true, false, false, false, false]);
    expect(cards.map((card) => card.getAttribute("data-battle-kind"))).toEqual(["assault", "entry", "assault", "assault", "meeting", "standing"]);
  });

  it("gives every attack its sides, odds, die, named modifiers, and effects", async () => {
    renderSession(resolution(spainShowcaseOutcomes()), "/resolution");
    await screen.findByRole("application", { name: /map/ });
    const card = document.querySelector('.battle-card[data-sides="3"]');
    if (!(card instanceof HTMLElement)) throw new Error("no three-sided card");
    const scope = within(card);
    expect(scope.getByText("Exchange")).toBeVisible();
    expect(scope.getByText(/attack: Attacker demoralized$/)).toBeVisible();
    expect(scope.getAllByRole("rowheader", { name: "Dug in level 1 (+1)" })).toHaveLength(2);
    expect(scope.getAllByRole("rowheader", { name: "Popular resistance +1" })).toHaveLength(2);
    expect(scope.getByRole("rowheader", { name: "Odds below 1:1 (1 halving)" })).toBeVisible();
    expect(scope.getAllByRole("table", { name: "Die roll and modifiers" })).toHaveLength(2);
    expect(scope.getByText("Wad-Ras Infantry Regiment No. 1 was destroyed, losing 550 men.")).toBeVisible();
    expect(card.querySelector(".battle-flavor")?.textContent).toMatch(/\S/);
    const rule = scope.getByText("How a battle with several attackers is decided");
    await userEvent.setup().click(rule);
    expect(scope.getByText(/Only the Southern Insurgent Command succeeded/)).toBeVisible();
  });

  it("reads the same flavor lines in a replay of the same game", async () => {
    const first = renderSession(resolution(spainShowcaseOutcomes()), "/resolution");
    await screen.findByRole("application", { name: /map/ });
    const lines = [...document.querySelectorAll(".battle-flavor")].map((element) => element.textContent);
    first.view.unmount();
    renderSession(resolution(spainShowcaseOutcomes()), "/resolution");
    await screen.findByRole("application", { name: /map/ });
    expect([...document.querySelectorAll(".battle-flavor")].map((element) => element.textContent)).toEqual(lines);
  });

  it("lists statuses and draws battle medallions on the map", async () => {
    const outcomes: readonly TurnOutcome[] = [
      ...spainShowcaseOutcomes(),
      { capturedByFactionId: faction("north"), cause: { holdingFactionIds: [faction("north")], kind: "held" }, kind: "disbanded-move", order: move("republic", "rep-catalan-columns", "catalunya", "aragon") }
    ];
    renderSession(resolution(outcomes), "/resolution");
    await screen.findByRole("application", { name: /map/ });
    const report = screen.getByRole("complementary", { name: "Turn report" });
    for (const label of ["Surrendered (1)", "Bounced (1)", "Recovered (1)", "Reinforcement arrived (1)"]) {
      expect(within(report).getByText(label)).toBeVisible();
    }
    expect(within(report).getByText(/recovered its morale in Valencia/)).toBeVisible();
    expect(document.querySelectorAll(".map-outcome-battle").length).toBeGreaterThanOrEqual(6);
    expect(document.querySelector('.map-outcome-battle[data-battle-result="both-demoralized"]')).not.toBeNull();
  });

  it("leaves the report as it was when no battle was fought", async () => {
    renderSession(resolution([{ factionId: faction("republic"), kind: "no-move", unitId: armyIn(initialGameState(spain()), "rep-wad-ras-1").id }]), "/resolution");
    await screen.findByRole("application", { name: /map/ });
    expect(screen.queryByRole("heading", { name: "Battles" })).toBeNull();
    expect(screen.getByRole("heading", { name: "What happened" })).toBeVisible();
  });
});

describe("planning with strength and morale (C5, C6, C15)", () => {
  afterEach(cleanup);

  const planning = (): Session => ({ draft: { orders: [], selectedUnitIds: [] }, factionId: faction("republic"), game: record(shakenMadrid()), phase: "planning" });

  it("prints values, men, and status on counters and in the army list", async () => {
    const { user } = renderSession(planning(), "/orders");
    await screen.findByRole("application", { name: /map/ });
    // Individual counters show from 125% zoom (Z1).
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    const counter = screen.getByRole("button", { name: /^Covadonga Infantry Regiment No. 4, Republican Government/ });
    // A scenario-given designation wins over the derived one; otherwise the name is abbreviated.
    expect(document.querySelector('[data-unit-id="rep-durruti-column"] .unit-counter-designation')?.textContent).toBe("DURR");
    expect(counter.querySelector(".unit-counter-designation")?.textContent).toBe("C4");
    expect(counter).toHaveAccessibleName(
      "Covadonga Infantry Regiment No. 4, Republican Government, attack 1, defence 2 (full 4-6), 370 of 550 men, demoralized, cannot attack, dug in level 2 (+2), resting"
    );
    expect(counter.querySelector(".unit-counter-current")?.textContent).toBe("1-2");
    expect(counter.querySelector(".unit-counter-full")?.textContent).toBe("4-6");
    expect(counter.querySelector(".unit-counter-works")?.getAttribute("data-level")).toBe("2");
    expect(counter.querySelector(".unit-counter-demoralized svg")).not.toBeNull();

    await user.click(counter);
    const pane = document.querySelector<HTMLElement>(".map-pane")!;
    expect(within(pane).getByRole("button", { name: /Covadonga Infantry Regiment No. 4/ })).toHaveAccessibleName(
      /370 of 550 men, demoralized, cannot attack, dug in level 2 \(\+2\)/
    );
    expect(within(pane).getByText(/Demoralized units fight at half their values and cannot attack/)).toBeVisible();
  });

  it("shows the odds at every destination and lets the pane choose one", async () => {
    const { user } = renderSession(planning(), "/orders");
    await screen.findByRole("application", { name: /map/ });
    // Individual counters show from 125% zoom (Z1).
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    await user.click(screen.getByRole("button", { name: /^Wad-Ras Infantry Regiment No. 1/ }));
    const pane = document.querySelector<HTMLElement>(".map-pane")!;
    await user.click(within(pane).getByRole("button", { name: "Clear" }));
    await user.click(within(pane).getByRole("button", { name: /^Wad-Ras Infantry Regiment No. 1/ }));
    await user.click(within(pane).getByRole("button", { name: "Move" }));
    const list = within(pane).getByRole("list", { name: "Destinations" });
    // Under `allowance` rail adds destinations beyond the two neighbours (M3, M4).
    const [battle] = within(list).getAllByRole("button", { name: /Approximately 1:\d+, \d+ percent to take it/ });
    expect(battle).toHaveTextContent(/Attack 4 against defence \d+/);
    expect(within(list).getByRole("button", { name: /^Castilla-La Mancha.*Reinforcement: it always arrives/ })).toBeVisible();
    expect(document.querySelectorAll(".odds-layer .odds-chip").length).toBeGreaterThanOrEqual(2);
    expect(document.querySelector('.odds-layer .odds-chip[data-territory-id="castilla-la-mancha"]')?.textContent).toBe("Reinforce");

    await user.click(within(list).getByRole("button", { name: /^Castilla-La Mancha.*Reinforcement/ }));
    await user.click(within(pane).getByRole("button", { name: "This turn" }));
    expect(within(pane).getByRole("list", { name: "Unit orders (1)" })).toBeVisible();
    expect(document.querySelector(".odds-layer")).toBeNull();
  });

  it("combines planned moves into the odds and says why they are approximate (A1, A2)", async () => {
    const session: Session = {
      draft: { orders: [move("republic", "rep-castilla-3", "extremadura", "castilla-y-leon")], selectedUnitIds: [] },
      factionId: faction("republic"),
      game: record(shakenMadrid()),
      phase: "planning"
    };
    const { user } = renderSession(session, "/orders");
    await screen.findByRole("application", { name: /map/ });
    // Individual counters show from 125% zoom (Z1).
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    const pane = document.querySelector<HTMLElement>(".map-pane")!;
    // The planned attack shows the odds of everything ordered there.
    expect(pane.querySelector(".order-list .planned-odds")).toHaveTextContent(/^Approx\. 1:\d+ \u00b7 \d+%Approximately 1:\d+, \d+ percent to take it\.$/);
    expect(within(pane).getByRole("button", { name: "About the planned odds" })).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByRole("button", { name: /^Wad-Ras Infantry Regiment No. 1/ }));
    await user.click(within(pane).getByRole("button", { name: "Clear" }));
    await user.click(within(pane).getByRole("button", { name: /^Wad-Ras Infantry Regiment No. 1/ }));
    await user.click(within(pane).getByRole("button", { name: "Move" }));
    const list = within(pane).getByRole("list", { name: "Destinations" });
    // Wad-Ras (attack 4) joins Castilla No. 3 (attack 4), already ordered there.
    const battle = within(list).getByRole("button", { name: /Castilla y Le\u00f3n/ });
    expect(battle).toHaveTextContent(/Attack 8 against defence \d+/);
    expect(battle).toHaveAccessibleName(/Approximately \d+:\d+, \d+ percent to take it\./);
    expect(document.querySelector('.odds-layer .odds-chip[data-territory-id="castilla-y-leon"]')?.textContent).toMatch(/^\u2248 \d+:\d+ \u00b7 \d+%$/);

    const info = within(pane).getByRole("button", { name: "About the destination odds" });
    const note = document.getElementById(info.getAttribute("aria-controls") ?? "");
    expect(note).toHaveTextContent("The defender may reinforce, or another faction may attack too, so the real odds may differ.");
    const expectOpen = (open: boolean) => {
      expect(info).toHaveAttribute("aria-expanded", String(open));
      if (open) expect(note).toBeVisible();
      else expect(note).not.toBeVisible();
    };
    expectOpen(false);
    await user.click(info);
    expectOpen(true);
    await user.click(info);
    expectOpen(false);
    info.focus();
    await user.keyboard("{Enter}");
    expectOpen(true);
    await user.keyboard(" ");
    expectOpen(false);
  });

  it("closes hostile destinations to a demoralized army and says why", async () => {
    const { user } = renderSession(planning(), "/orders");
    await screen.findByRole("application", { name: /map/ });
    // Individual counters show from 125% zoom (Z1).
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    await user.click(screen.getByRole("button", { name: /^Covadonga Infantry Regiment No. 4/ }));
    const pane = document.querySelector<HTMLElement>(".map-pane")!;
    await user.click(within(pane).getByRole("button", { name: "Move" }));
    // The engine offers a demoralized army only empty or friendly destinations (M23).
    const list = within(pane).getByRole("list", { name: "Destinations" });
    expect(within(list).queryByRole("button", { name: /Castilla y Le\u00f3n/ })).toBeNull();
    expect(within(list).getByRole("button", { name: /Castilla-La Mancha/ })).toBeVisible();
    expect(within(pane).getByText(/may move only into empty or friendly territory/)).toBeVisible();
  });
});
