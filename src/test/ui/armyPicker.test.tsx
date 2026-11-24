import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it } from "vitest";
import { initialGameState } from "../../main/engine/resolution";
import type { GameState, Scenario, TerritoryId, UnitId, UnitState, UnitTypeId } from "../../main/engine/types";
import { RegistryContext } from "../../main/hooks";
import { createAppStore } from "../../main/state/store";
import { ArmyPicker } from "../../main/screens/ArmyPicker";
import { SelectionBar } from "../../main/screens/shell/SelectionBar";
import { BattleBasics } from "../../main/screens/BattleBasics";
import type { PlanningSession } from "../../main/state/planning";
import type { Draft } from "../../main/state/session";
import { faction, move, shippedRegistry, spain, spainId, spainM2, spainWithAir, territory, testRegistry, testStore, unit } from "../support";

afterEach(cleanup);

function planning(state: GameState, factionId: string, draft: Draft): PlanningSession {
  return { draft, factionId: faction(factionId), game: { assignments: { [faction(factionId)]: "local-human" }, history: [], locked: {}, scenarioId: spainId, seed: 1, state }, phase: "planning" };
}

const ownIn = (scenario: Scenario, state: GameState, factionId: string, territoryId: string): readonly UnitState[] =>
  Object.values(state.units).filter((entry) => entry.factionId === faction(factionId) && entry.territoryId === territoryId && scenario.index.unitTypes.get(scenario.index.units.get(entry.id)?.type ?? ("" as never))?.kind === "ground");

function renderPicker(scenario: Scenario, session: PlanningSession, own: readonly UnitState[]) {
  const store = testStore({ game: { session } });
  const user = userEvent.setup();
  render(
    <Provider store={store}>
      <RegistryContext value={testRegistry()}>
        <ArmyPicker own={own} scenario={scenario} session={session} />
      </RegistryContext>
    </Provider>
  );
  return { store, user };
}

const selecting = (territoryId: string, own: readonly UnitState[], extra: Partial<Draft> = {}): Draft => ({ orders: [], selectedTerritoryId: territory(territoryId), selectedUnitIds: own.map((entry) => entry.id), ...extra });
const metaOf = (name: RegExp): string => screen.getAllByRole("button").find((button) => name.test(button.textContent))?.querySelector(".formation-meta")?.textContent ?? "";

describe("the army picker (O1, O2)", () => {
  const scenario = spain();
  const start = initialGameState(scenario);
  const madrid = ownIn(scenario, start, "republic", "madrid");

  it("lists the armies with their orders and counts the selection", async () => {
    const session = planning(start, "republic", selecting("madrid", madrid.slice(0, 2)));
    const { store, user } = renderPicker(scenario, session, madrid);
    const list = screen.getByRole("list", { name: /^Your (armies|units)$/u });
    expect(within(list).getAllByRole("listitem")).toHaveLength(madrid.length);
    expect(screen.getByText(`2 of ${String(madrid.length)} selected`)).toBeTruthy();
    const pressed = within(list).getAllByRole("button").filter((button) => button.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(2);
    expect(pressed[0]?.querySelector(".formation-meta")?.textContent).toMatch(/\u00b7 Entrenching$/u);
    // U4: Clear lives in the selection bar; the list keeps Select all.
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Select all" }));
    const all = store.getState().game.session;
    expect(all.phase === "planning" ? all.draft.selectedUnitIds.length : 0).toBe(madrid.length);
    await user.click(pressed[0]!);
    const toggled = store.getState().game.session;
    expect(toggled.phase === "planning" ? toggled.draft.selectedUnitIds.length : 0).toBe(madrid.length - 1);
  });

  it("names a withdrawal's destination", () => {
    const state = initialGameState(scenario);
    const own = ownIn(scenario, state, "republic", "andalucia");
    const withdraw = { factionId: faction("republic"), from: territory("andalucia"), kind: "withdraw" as const, to: territory("murcia"), unitId: own[0]!.id };
    renderPicker(scenario, planning(state, "republic", { orders: [withdraw], selectedTerritoryId: territory("andalucia"), selectedUnitIds: [] }), own);
    expect(metaOf(/./u)).toMatch(/\u00b7 Withdrawing to Murcia$/u);
  });

  it("says when every army is moving, and names where each goes", () => {
    const orders = madrid.map((entry) => move("republic", entry.id, "madrid", "castilla-la-mancha"));
    renderPicker(scenario, planning(start, "republic", { orders, selectedTerritoryId: territory("madrid"), selectedUnitIds: [] }), madrid);
    expect(screen.getByText("All moving")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Select all" })).toBeNull();
    const buttons = screen.getAllByRole("button").filter((button) => button.classList.contains("formation-button"));
    expect(buttons.every((button) => button.getAttribute("data-ordered") === "true")).toBe(true);
    expect(buttons[0]?.querySelector(".formation-meta")?.textContent).toMatch(/\u00b7 Moving to Castilla-La Mancha$/u);
  });

  it("disables the armies and hides Select all while a destination is chosen", () => {
    renderPicker(scenario, planning(start, "republic", selecting("madrid", madrid.slice(0, 1), { stage: { orderKind: "move", step: "choose-destination" } })), madrid);
    const buttons = screen.getAllByRole("button").filter((button) => button.classList.contains("formation-button"));
    expect(buttons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.queryByRole("button", { name: "Select all" })).toBeNull();
  });

  it("shows how far below strength an army is, and its Replenish order", () => {
    const worn = madrid[0]!;
    const definition = scenario.index.units.get(worn.id)!;
    const state: GameState = { ...start, units: { ...start.units, [worn.id]: { ...worn, strength: definition.fullStrength - 300 } } };
    const replenishing = planning(state, "republic", selecting("madrid", [], { replenishments: [{ factionId: faction("republic"), kind: "replenish", unitId: worn.id }] }));
    renderPicker(scenario, replenishing, ownIn(scenario, state, "republic", "madrid"));
    expect(screen.getByText("Below strength: 300 men short")).toBeTruthy();
    expect(metaOf(new RegExp(definition.name, "u"))).toMatch(/\u00b7 Replenishing \(\+\d+ men\)$/u);
    cleanup();
    const noRecruiting: Scenario = { ...scenario, rules: { ...scenario.rules, recruitment: "none" } };
    renderPicker(noRecruiting, planning(state, "republic", selecting("madrid", [])), ownIn(scenario, state, "republic", "madrid"));
    expect(screen.queryByText(/Below strength/u)).toBeNull();
  });

  it("explains the demoralized rule when a demoralized army is selected", () => {
    const shaken = madrid[0]!;
    const state: GameState = { ...start, units: { ...start.units, [shaken.id]: { ...shaken, morale: { demoralized: true, quietTurns: 0 } } } };
    const own = ownIn(scenario, state, "republic", "madrid");
    renderPicker(scenario, planning(state, "republic", selecting("madrid", [own[0]!])), own);
    expect(screen.getByText(/^Demoralized (armies|units) fight at half their values/u)).toBeTruthy();
    expect(metaOf(/./u)).toMatch(/Resting$/u);
  });
});

function renderBar(scenario: Scenario, session: PlanningSession) {
  const store = testStore({ game: { session } });
  const user = userEvent.setup();
  render(<Provider store={store}><SelectionBar scenario={scenario} session={session} /></Provider>);
  return { store, user };
}

describe("the selection bar in contested ground (C1, Q-UX-14)", () => {
  const open = (scenario: Scenario, factionId: string, territoryId: string, ready = initialGameState(scenario)) => {
    const state = ready;
    const own = ownIn(scenario, state, factionId, territoryId);
    renderBar(scenario, planning(state, factionId, selecting(territoryId, own)));
    return screen.getByRole("group", { name: "Orders for the selected units" });
  };

  it("joins the standing battle by default, and withdraws to the one way out", () => {
    const menu = open(spain(), "republic", "asturias");
    expect(menu.textContent).toContain("Default here. Joins the standing battle for Asturias; +1 fatigue.");
    expect(menu.textContent).toMatch(/To Cantabria, through your own sub-territories \(.+\)\./u);
    expect(menu.textContent).toContain("Not in contested ground: units here attack or withdraw.");
    expect(within(menu).getByRole("button", { name: "Replenish" })).toBeDisabled();
    expect(within(menu).getByRole("button", { name: "Attack" })).toBeEnabled();
  });

  it("lists the sea lane as the way out", () => {
    const menu = open(spainWithAir(), "republic", "andalucia");
    expect(menu.textContent).toContain("Joins the standing battle for Andaluc\u00eda; +1 fatigue.");
    expect(menu.textContent).toMatch(/To Murcia, through/u);
  });

  it("says when there is no way out", () => {
    const menu = open(spain(), "republic", "islas-baleares");
    expect(menu.textContent).toContain("No way out: every neighbouring territory you hold is cut off from your sub-territories here.");
  });

  it("sweeps an empty contested territory, and lists three ways out", () => {
    // R2: the Barbastro garrison stands in Arag\u00f3n at the start; with it gone, the North sweeps.
    const scenario = spain();
    const start = initialGameState(scenario);
    const garrison = start.units["rep-barbastro-garrison" as UnitId];
    const menu = open(scenario, "north", "aragon", { ...start, units: { ...start.units, ["rep-barbastro-garrison" as UnitId]: { ...garrison!, territoryId: "catalunya" as TerritoryId } } });
    expect(menu.textContent).toContain("Default here. Takes one enemy sub-territory of Arag\u00f3n a turn, the capital last.");
    expect(menu.textContent).toMatch(/To Navarra, La Rioja or Castilla y Le\u00f3n, through/u);
  });

  it("offers the ordinary orders without partition", () => {
    const scenario = spainM2();
    const state = initialGameState(scenario);
    const own = ownIn(scenario, state, "republic", "asturias");
    renderBar(scenario, planning(state, "republic", selecting("asturias", own)));
    const menu = screen.getByRole("group", { name: "Orders for the selected units" });
    expect(menu.textContent).not.toContain("Default here.");
    expect(within(menu).getByRole("button", { name: /^Move/u })).toBeTruthy();
  });
});

describe("How battles work (B2)", () => {
  it("explains the rules with a worked example", () => {
    render(<BattleBasics scenario={spain()} />);
    const section = screen.getByRole("region", { name: "How battles work" });
    expect(section.textContent).toContain("fights at half its values");
    expect(section.querySelector(".pane-hint")?.textContent).toMatch(/^Example: two .+ (armies|units) attack with \d+ against one with defence \d+, dug in level \d+ \(\+\d+\)\. That is .+ odds: \d+% to take the territory\. A third (army|unit) makes it \d+ against \d+, .+ odds: \d+%\.$/u);
  });

  it("states the d20, its fatigue and the works in the scenario's numbers", () => {
    const scenario = spainWithAir();
    render(<BattleBasics scenario={scenario} />);
    const section = screen.getByRole("region", { name: "How battles work" });
    expect(section.textContent).toContain(`Battles roll a d20.`);
    expect(section.textContent).toContain(`at fatigue ${String(scenario.d20.fatigue.fatiguedLevel)} it fights Fatigued (${String(scenario.d20.modifiers.fatigued)})`);
    expect(section.textContent).toContain(`up to three, and each level shifts the die ${String(scenario.d20.modifiers.worksPerTurn)} in the defenders' favour`);
  });

  it("states another demoralization factor as a percentage, and leaves the example out without unit types", () => {
    const scenario = spain();
    render(<BattleBasics scenario={{ ...scenario, combat: { ...scenario.combat, demoralizationFactor: 0.75 }, unitTypes: [] }} />);
    const section = screen.getByRole("region", { name: "How battles work" });
    expect(section.textContent).toContain("fights at 75% of its values");
    expect(section.querySelector(".pane-hint")).toBeNull();
  });

  it("leaves out the works when digging in gains nothing", () => {
    const scenario = spain();
    render(<BattleBasics scenario={{ ...scenario, combat: { ...scenario.combat, diggingIn: { max: 0, perTurn: 0 } } }} />);
    const hint = screen.getByRole("region", { name: "How battles work" }).querySelector(".pane-hint")?.textContent ?? "";
    expect(hint).not.toContain("dug in");
    expect(hint).toMatch(/against one with defence \d+\. /u);
  });
});


describe("a general's pill and Sack order in the army list (U5, `ux-pane-a-units`)", () => {
  const scenario = spainWithAir();
  const start = initialGameState(scenario);
  const madrid = Object.values(start.units).filter((entry) => entry.factionId === faction("republic") && entry.territoryId === territory("madrid") && scenario.index.units.get(entry.id)?.type !== ("fighter-squadron" as UnitTypeId) && scenario.index.units.get(entry.id)?.type !== ("bomber-squadron" as UnitTypeId));
  const miaja = unit("rep-general-miaja");
  const sackMiaja = { factionId: faction("republic"), kind: "sack" as const, unitId: miaja };

  /** The Sack order is validated against the shipped Spain, which has its generals. */
  function renderWithGenerals(target: Scenario, session: PlanningSession) {
    const store = createAppStore({ preloadedState: { game: { session } }, registry: shippedRegistry() });
    render(
      <Provider store={store}>
        <RegistryContext value={shippedRegistry()}>
          <ArmyPicker own={madrid} scenario={target} session={session} />
        </RegistryContext>
      </Provider>
    );
    return store;
  }

  it("names the general and his trait, and plans a free Sack that replaces his move", async () => {
    const session = planning(start, "republic", selecting("madrid", [], { orders: [move("republic", "rep-general-miaja", "madrid", "castilla-la-mancha")] }));
    const store = renderWithGenerals(scenario, session);
    const pill = screen.getByTitle("Jos\u00e9 Miaja: Tenacious");
    expect(pill).toHaveTextContent("Jos\u00e9 Miaja \u00b7 Tenacious");
    // Only the general has the pill.
    expect(document.querySelectorAll(".general-pill")).toHaveLength(1);
    const sack = screen.getByRole("button", { name: "Sack" });
    expect(sack).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText(/Relieved this turn/u)).toBeNull();
    await userEvent.click(sack);
    const after = store.getState().game.session;
    expect(after.phase === "planning" ? after.draft.airOrders : undefined).toEqual([sackMiaja]);
    // U5: Sack replaces the general's move.
    expect(after.phase === "planning" ? after.draft.orders : undefined).toEqual([]);
  });

  it("shows a planned sacking: Keep him, and when the next general arrives; Keep him withdraws it", async () => {
    const session = planning(start, "republic", selecting("madrid", [], { airOrders: [sackMiaja] }));
    const store = renderWithGenerals(scenario, session);
    const keep = screen.getByRole("button", { name: "Keep him" });
    expect(keep).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Relieved this turn; the next general arrives the turn after.")).toBeVisible();
    await userEvent.click(keep);
    const after = store.getState().game.session;
    expect(after.phase === "planning" ? after.draft.airOrders : undefined).toEqual([]);
  });

  it("offers no Sack where the scenario's general type cannot take that order", () => {
    const noSack: Scenario = {
      ...scenario,
      index: { ...scenario.index, unitTypes: new Map([...scenario.index.unitTypes].map(([id, type]) => [id, type.kind === "general" ? { ...type, orders: type.orders.filter((order) => order !== "sack") } : type])) }
    };
    renderWithGenerals(noSack, planning(start, "republic", selecting("madrid", [])));
    expect(screen.getByTitle("Jos\u00e9 Miaja: Tenacious")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Sack" })).toBeNull();
  });
});
