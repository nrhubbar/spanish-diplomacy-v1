import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it } from "vitest";
import { GameHeader } from "../main/components/GameHeader";
import { initialGameState } from "../main/engine/resolution";
import type { BuildOrder, GameState, SubTerritoryId } from "../main/engine/types";
import { viewFor } from "../main/engine/visibility";
import { RegistryContext } from "../main/hooks";
import { TerritoryView } from "../main/screens/shell/views/TerritoryView";
import { cancelBuildOrder, clickMapTerritory, endTurn, focusSubTerritory, queueBuildOrder } from "../main/state/gameSlice";
import { plannedBuilds, type PlanningSession } from "../main/state/planning";
import { emptyDraft } from "../main/state/session";
import { faction, spain, spainId, territory, testRegistry, testStore } from "./support";
import { unfortified } from "./pinned";

afterEach(cleanup);

const barcelona = "barcelona" as SubTerritoryId;
const fortify = (factionId = "republic"): BuildOrder => ({ factionId: faction(factionId), kind: "build", project: { buildingId: "fortifications" as never, kind: "building" }, subTerritoryId: barcelona });

/** A Spain game with the Republic planning and the other two factions run by the computer. */
function planning(state: GameState = unfortified(initialGameState(spain()))) {
  const game = { assignments: { [faction("republic")]: "local-human" as const, [faction("north")]: "computer" as const, [faction("south")]: "computer" as const }, history: [], locked: {}, scenarioId: spainId, seed: 1, state };
  return testStore({ game: { session: { draft: emptyDraft, factionId: faction("republic"), game, phase: "planning" } } });
}

const session = (store: ReturnType<typeof planning>): PlanningSession => store.getState().game.session as PlanningSession;

function renderPane(store: ReturnType<typeof planning>) {
  const view = () => <Provider store={store}><RegistryContext value={testRegistry()}><TerritoryView scenario={spain()} session={session(store)} territoryId={session(store).draft.selectedTerritoryId!} /></RegistryContext></Provider>;
  const rendered = render(view());
  return { rerender: () => { rendered.rerender(view()); } };
}

describe("planned Build orders ($5)", () => {
  it("survive selection and moves, and go into the submission at End Turn", () => {
    const store = planning();
    store.dispatch(queueBuildOrder(fortify()));
    store.dispatch(clickMapTerritory(territory("madrid")));
    store.dispatch(clickMapTerritory(territory("catalunya")));
    expect(plannedBuilds(session(store))).toEqual([fortify()]);
    store.dispatch(endTurn());
    const after = store.getState().game.session;
    expect(after.phase).toBe("resolution");
    if (after.phase !== "resolution") return;
    expect(after.result.outcomes.some((outcome) => outcome.kind === "build-queued" && outcome.order.subTerritoryId === barcelona)).toBe(true);
  });

  it("refuse an order that is invalid or no longer fits, with the reason", () => {
    const store = planning();
    store.dispatch(queueBuildOrder(fortify()));
    store.dispatch(queueBuildOrder(fortify()));
    expect(plannedBuilds(session(store))).toHaveLength(1);
    expect(session(store).draft.feedback).toBe("Already in the queue.");
    store.dispatch(queueBuildOrder({ ...fortify(), subTerritoryId: "sevilla" as SubTerritoryId }));
    expect(session(store).draft.feedback).toMatch(/not yours/);
    store.dispatch(cancelBuildOrder(0));
    expect(plannedBuilds(session(store))).toEqual([]);
  });
});

describe("the Buildings tab and its opening cards (X3, X7, U9)", () => {
  it("shows closed sub-territory cards that open on pips and buildings, focusing the sub-territory", async () => {
    const store = planning();
    store.dispatch(clickMapTerritory(territory("catalunya")));
    renderPane(store);
    await userEvent.click(screen.getByRole("tab", { name: "Buildings" }));
    const card = screen.getByRole("article", { name: "Barcelona" });
    expect(within(card).queryByRole("list", { name: "Buildings" })).toBeNull();
    await userEvent.click(within(card).getByRole("button", { expanded: false }));
    expect(within(card).getByRole("img", { name: "Factory level 2 of 3" })).toBeInTheDocument();
    expect(within(card).getByRole("list", { name: "Buildings" })).toHaveTextContent("Barracks");
    expect(session(store).draft.focusedSubTerritoryId).toBe(barcelona);
  });

  it("queues from the focus view, shows the item in the queue, and cancels it", async () => {
    const store = planning();
    store.dispatch(focusSubTerritory(barcelona));
    const pane = renderPane(store);
    expect(screen.getByText("Add to the queue")).toBeInTheDocument();
    expect(screen.getAllByText("Already built.").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Queue Fortifications" }));
    pane.rerender();
    const queue = screen.getByRole("list", { name: "Build queue" });
    expect(queue).toHaveTextContent("Fortifications");
    expect(within(queue).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    await userEvent.click(within(queue).getByRole("button", { name: "Cancel Fortifications" }));
    pane.rerender();
    expect(screen.queryByRole("list", { name: "Build queue" })).toBeNull();
  });

  it("hides another faction's queue", () => {
    const store = planning();
    store.dispatch(focusSubTerritory("sevilla" as SubTerritoryId));
    renderPane(store);
    expect(screen.getByText("Queue hidden")).toBeInTheDocument();
    expect(screen.queryByText("Add to the queue")).toBeNull();
  });
});

describe("the Funds and Manpower chips (X1, $6)", () => {
  it("show balances with next turn's income, and hide other balances in the detail", async () => {
    const store = planning();
    const scenario = spain();
    const state = viewFor(scenario, initialGameState(scenario), faction("republic"));
    render(<Provider store={store}><RegistryContext value={testRegistry()}><GameHeader kicker="Turn 1" slots={{ scenario, state, viewer: faction("republic") }} title="Republic" /></RegistryContext></Provider>);
    const funds = screen.getByRole("button", { name: /^Funds 40 \+17\.5 ?next turn$/ });
    // EB-12: Manpower reads through its display scale, as in the approved capture ("Manpower 18k").
    const manpower = screen.getByRole("button", { name: /^Manpower 10k \+3\.5k ?next turn$/ });
    await userEvent.click(manpower);
    expect(screen.getByRole("region", { name: "Manpower detail" })).toHaveTextContent("Manpower: 10k now \u00b7 +3.5k next turn");
    expect(screen.getByRole("region", { name: "Manpower detail" })).toHaveTextContent("You hold 10k (10,000).");
    await userEvent.click(funds);
    expect(funds).toHaveAttribute("aria-expanded", "true");
    const detail = screen.getByRole("region", { name: "Funds detail" });
    expect(within(detail).getByRole("list", { name: "Other factions" })).toHaveTextContent("Northern Insurgent Commandhidden");
  });

  it("render nothing without a viewer", () => {
    const store = planning();
    const scenario = spain();
    render(<Provider store={store}><RegistryContext value={testRegistry()}><GameHeader kicker="Turn 1" slots={{ scenario, state: initialGameState(scenario) }} title="Report" /></RegistryContext></Provider>);
    expect(screen.queryByRole("button", { name: /^Funds/ })).toBeNull();
  });
});
