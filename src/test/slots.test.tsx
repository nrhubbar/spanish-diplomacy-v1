import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it } from "vitest";
import { GameHeader } from "../main/components/GameHeader";
import { initialGameState } from "../main/engine/resolution";
import type { Scenario, ScenarioId, SubTerritoryId } from "../main/engine/types";
import { RegistryContext } from "../main/hooks";
import { TerritoryView } from "../main/screens/shell/views/TerritoryView";
import { clickMapTerritory, focusSubTerritory } from "../main/state/gameSlice";
import type { PlanningSession } from "../main/state/planning";
import { emptyDraft } from "../main/state/session";
import { faction, spain, spainId, territory, testRegistry, testStore, tiny, tinyId } from "./support";

afterEach(cleanup);

function planning(scenario: Scenario, scenarioId: ScenarioId, factionId: string) {
  const game = { assignments: { [faction(factionId)]: "local-human" as const }, history: [], locked: {}, scenarioId, seed: 1, state: initialGameState(scenario) };
  return testStore({ game: { session: { draft: emptyDraft, factionId: faction(factionId), game, phase: "planning" } } });
}

function renderPane(store: ReturnType<typeof testStore>, scenario: Scenario) {
  const view = () => {
    const session = store.getState().game.session as PlanningSession;
    return <Provider store={store}><RegistryContext value={testRegistry()}><TerritoryView scenario={scenario} session={session} territoryId={session.draft.selectedTerritoryId!} /></RegistryContext></Provider>;
  };
  const rendered = render(view());
  return { rerender: () => { rendered.rerender(view()); } };
}

describe("the territory pane's tabs and focus view (X3, U9)", () => {
  it("opens on Units, with Buildings, Recruit and Production present but empty, under m3-modular", async () => {
    const store = planning(spain(), spainId, "republic");
    store.dispatch(clickMapTerritory(territory("madrid")));
    renderPane(store, spain());
    // M6: Units carries a count of the viewer's units here; Build counts sub-territories with work queued.
    expect(screen.getAllByRole("tab").map((tab) => [tab.textContent, tab.getAttribute("aria-selected")])).toEqual([["Units 4", "true"], ["Buildings", "false"], ["Recruit", "false"], ["Production", "false"]]);
    expect(screen.getByText(/^Held whole by Republican Government \u00b7 3 sub-territories$/u)).toBeVisible();
    expect(screen.getByText(/^Recruits at /u)).toBeVisible();
    // The heading and its meta row sit above the tabs, so they show on every tab.
    expect(screen.getByRole("heading", { name: "Madrid" })).toBeVisible();
    expect(screen.getByRole("tabpanel")).not.toContainElement(screen.getByRole("heading", { name: "Madrid" }));
    await userEvent.click(screen.getByRole("tab", { name: "Buildings" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Sub-territories");
    expect(screen.getByRole("heading", { name: "Madrid" })).toBeVisible();
    await userEvent.click(screen.getByRole("tab", { name: "Recruit" }));
    expect(screen.getByRole("tab", { name: "Recruit" })).toHaveAttribute("aria-selected", "true");
  });

  it("moves between tabs with the arrow keys, Home and End, with one tab stop (m2)", async () => {
    const store = planning(spain(), spainId, "republic");
    store.dispatch(clickMapTerritory(territory("madrid")));
    renderPane(store, spain());
    const user = userEvent.setup();
    const units = screen.getByRole("tab", { name: /^Units/u });
    expect(screen.getAllByRole("tab").map((tab) => tab.tabIndex)).toEqual([0, -1, -1, -1]);
    units.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Buildings" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Buildings" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Production" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(units).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Production" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(units).toHaveAttribute("aria-selected", "true");
    await user.keyboard("a");
    expect(units).toHaveFocus();
  });

  it("keeps the Milestone 2 pane without tabs under m2-strength", () => {
    const store = planning(tiny(), tinyId, "red");
    store.dispatch(clickMapTerritory(territory("westfold")));
    renderPane(store, tiny());
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByRole("heading", { name: "Westfold" })).toBeInTheDocument();
  });

  it("opens Buildings with a sub-territory's card open when it is focused on the map, and closes it", async () => {
    const store = planning(spain(), spainId, "republic");
    store.dispatch(clickMapTerritory(territory("asturias")));
    const pane = renderPane(store, spain());
    expect(screen.getByRole("tab", { name: /^Units/u })).toHaveAttribute("aria-selected", "true");
    act(() => { store.dispatch(focusSubTerritory("oviedo" as SubTerritoryId)); });
    pane.rerender();
    expect(screen.getByRole("tab", { name: /^Buildings/u })).toHaveAttribute("aria-selected", "true");
    const oviedo = screen.getByRole("button", { expanded: true });
    expect(oviedo).toHaveTextContent("Oviedo");
    await userEvent.click(oviedo);
    pane.rerender();
    expect(store.getState().game.session.phase === "planning" && (store.getState().game.session as PlanningSession).draft.focusedSubTerritoryId).toBeUndefined();
    expect(screen.queryByRole("button", { expanded: true })).toBeNull();
    expect(screen.getByRole("tab", { name: /^Buildings/u })).toHaveAttribute("aria-selected", "true");
  });

  it("opens on the tab a view names, and on Buildings with a named sub-territory's card open", () => {
    const store = planning(spain(), spainId, "republic");
    const session = () => store.getState().game.session as PlanningSession;
    const shown = render(<Provider store={store}><RegistryContext value={testRegistry()}><TerritoryView scenario={spain()} session={session()} tab="production" territoryId={territory("madrid")} /></RegistryContext></Provider>);
    expect(screen.getByRole("tab", { name: "Production" })).toHaveAttribute("aria-selected", "true");
    shown.rerender(<Provider store={store}><RegistryContext value={testRegistry()}><TerritoryView scenario={spain()} session={session()} subTerritory={"henares" as SubTerritoryId} tab="units" territoryId={territory("madrid")} /></RegistryContext></Provider>);
    expect(screen.getByRole("tab", { name: /^Buildings/u })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { expanded: true })).toHaveTextContent("Henares");
  });

  it("keeps a card the player closed closed when they leave Buildings and come back", async () => {
    const store = planning(spain(), spainId, "republic");
    const session = () => store.getState().game.session as PlanningSession;
    const node = () => <Provider store={store}><RegistryContext value={testRegistry()}><TerritoryView scenario={spain()} session={session()} subTerritory={"henares" as SubTerritoryId} territoryId={territory("madrid")} /></RegistryContext></Provider>;
    const shown = render(node());
    await userEvent.click(screen.getByRole("button", { expanded: true }));
    shown.rerender(node());
    await userEvent.click(screen.getByRole("tab", { name: /^Units/u }));
    await userEvent.click(screen.getByRole("tab", { name: /^Buildings/u }));
    expect(screen.queryByRole("button", { expanded: true })).toBeNull();
  });

  it("refocuses within the same territory and keeps the selection", () => {
    const store = planning(spain(), spainId, "republic");
    store.dispatch(clickMapTerritory(territory("madrid")));
    store.dispatch(focusSubTerritory("henares" as SubTerritoryId));
    const session = store.getState().game.session as PlanningSession;
    expect([session.draft.selectedTerritoryId, session.draft.focusedSubTerritoryId, session.draft.selectedUnitIds.length > 0]).toEqual(["madrid", "henares", true]);
  });
});

describe("the header slots", () => {
  it("render nothing yet, leaving the Milestone 2 header", () => {
    const store = testStore();
    const { container } = render(<Provider store={store}><GameHeader kicker="k" slots={{ scenario: tiny(), state: initialGameState(tiny()) }} title="t" /></Provider>);
    expect(container.querySelectorAll(".game-header > *")).toHaveLength(2);
  });
});
