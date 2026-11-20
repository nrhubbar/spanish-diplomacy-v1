import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it } from "vitest";
import { GameHeader } from "../main/components/GameHeader";
import { initialGameState } from "../main/engine/resolution";
import type { Scenario, ScenarioId, SubTerritoryId } from "../main/engine/types";
import { RegistryContext } from "../main/hooks";
import { OrderBuilder } from "../main/screens/OrderBuilder";
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
    return <Provider store={store}><RegistryContext value={testRegistry()}><OrderBuilder estimates={new Map()} scenario={scenario} session={session} /></RegistryContext></Provider>;
  };
  const rendered = render(view());
  return { rerender: () => { rendered.rerender(view()); } };
}

describe("the territory pane's tabs and focus view (X3)", () => {
  it("opens on Units, with Build and Recruit present but empty, under m3-modular", async () => {
    const store = planning(spain(), spainId, "republic");
    store.dispatch(clickMapTerritory(territory("madrid")));
    renderPane(store, spain());
    expect(screen.getAllByRole("tab").map((tab) => [tab.textContent, tab.getAttribute("aria-selected")])).toEqual([["Units", "true"], ["Build", "false"], ["Recruit", "false"]]);
    // The heading and its meta row sit above the tabs, so they show on every tab.
    expect(screen.getByRole("heading", { name: "Madrid" })).toBeVisible();
    expect(screen.getByRole("tabpanel")).not.toContainElement(screen.getByRole("heading", { name: "Madrid" }));
    await userEvent.click(screen.getByRole("tab", { name: "Build" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Sub-territories");
    expect(screen.getByRole("heading", { name: "Madrid" })).toBeVisible();
    await userEvent.click(screen.getByRole("tab", { name: "Recruit" }));
    expect(screen.getByRole("tab", { name: "Recruit" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the Milestone 2 pane without tabs under m2-strength", () => {
    const store = planning(tiny(), tinyId, "red");
    store.dispatch(clickMapTerritory(territory("westfold")));
    renderPane(store, tiny());
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByRole("heading", { name: "Westfold" })).toBeInTheDocument();
  });

  it("focuses on a sub-territory and links back to its territory", async () => {
    const store = planning(spain(), spainId, "republic");
    store.dispatch(focusSubTerritory("oviedo" as SubTerritoryId));
    const pane = renderPane(store, spain());
    expect(screen.getByRole("heading", { name: "Oviedo" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back to Asturias" }));
    pane.rerender();
    expect(screen.getByRole("heading", { name: "Asturias" })).toBeInTheDocument();
    store.dispatch(focusSubTerritory("nowhere" as SubTerritoryId));
    act(() => { pane.rerender(); });
    expect(screen.queryByRole("button", { name: /Back to/ })).toBeNull();
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
