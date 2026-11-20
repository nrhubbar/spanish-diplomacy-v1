import { cleanup, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it } from "vitest";
import { initialGameState } from "../main/engine/resolution";
import type { GameState, SubTerritoryId } from "../main/engine/types";
import { RegistryContext } from "../main/hooks";
import { SubTerritoryFocus } from "../main/screens/pane/SubTerritoryFocus";
import { emptyDraft } from "../main/state/session";
import { faction, spain, spainId, testRegistry, testStore } from "./support";

afterEach(cleanup);

/** X3: the pane focused on one sub-territory, for a capital port with rail, and a contested inland one. */
function show(id: string, state: GameState = initialGameState(spain())) {
  const game = { assignments: {}, history: [], locked: {}, scenarioId: spainId, seed: 1, state };
  const store = testStore({ game: { session: { draft: emptyDraft, factionId: faction("republic"), game, phase: "planning" } } });
  return render(<Provider store={store}><RegistryContext value={testRegistry()}><SubTerritoryFocus factionId={faction("republic")} scenario={spain()} state={state} subTerritoryId={id as SubTerritoryId} /></RegistryContext></Provider>);
}

describe("the sub-territory focus (X3)", () => {
  it("shows a capital port with rail and its city", () => {
    show("barcelona");
    expect(screen.getByRole("button", { name: "Back to Catalu\u00f1a" })).toBeInTheDocument();
    expect(screen.getByText(/Capital sub-territory of Catalu\u00f1a/)).toBeInTheDocument();
    expect(screen.getByText(/port 2/)).toBeInTheDocument();
    expect(screen.getByText(/^Rail \d$/)).toBeInTheDocument();
    expect(screen.getByText(/Cities: /)).toBeInTheDocument();
    expect(screen.queryByText("Contested ground")).toBeNull();
  });

  it("shows a contested sub-territory that is not the capital, with no port or rail", () => {
    const state = initialGameState(spain());
    const site = state.subTerritories["caceres" as SubTerritoryId];
    if (site === undefined) throw new Error("caceres");
    show("caceres", { ...state, subTerritories: { ...state.subTerritories, ["caceres" as SubTerritoryId]: { ...site, port: 0, rail: 0 } } });
    expect(screen.getByText(/^Sub-territory of Extremadura/)).toBeInTheDocument();
    expect(screen.getByText("Contested ground")).toBeInTheDocument();
    expect(screen.getByText(/Extremadura is contested/)).toBeInTheDocument();
    expect(screen.queryByText(/port \d/)).toBeNull();
    expect(screen.queryByText(/^Rail \d$/)).toBeNull();
  });

  it("renders nothing for an unknown sub-territory", () => {
    const { container } = show("nowhere");
    expect(container.querySelector(".sub-territory-focus")).toBeNull();
  });
});
