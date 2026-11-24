import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initialGameState } from "../../main/engine/resolution";
import { MusterView } from "../../main/screens/actions/MusterView";
import type { PlanningSession } from "../../main/state/planning";
import { faction, spainWithAir, spainId, territory, testStore } from "../support";

// The engine takes back a move between drawing the pane and ordering it (the board changed).
vi.mock("../../main/state/planning", async (original) => ({ ...await original<typeof import("../../main/state/planning")>(), musterRefusal: () => "That route is closed now." }));

afterEach(cleanup);

describe("U6: a refused order", () => {
  it("keeps the pane and its ticks, and says why", async () => {
    const scenario = spainWithAir();
    const session: PlanningSession = {
      draft: { orders: [], selectedUnitIds: [] },
      factionId: faction("republic"),
      game: { assignments: {}, history: [], locked: {}, scenarioId: spainId, seed: 1, state: initialGameState(scenario) },
      phase: "planning"
    };
    const store = testStore();
    const dispatched = vi.spyOn(store, "dispatch");
    const user = userEvent.setup();
    render(<Provider store={store}><MusterView kind="reinforce" scenario={scenario} session={session} target={territory("castilla-la-mancha")} /></Provider>);
    const pane = screen.getByRole("region", { name: "Reinforce" });
    const [first] = within(pane).getAllByRole("checkbox");
    await user.click(first!);
    await user.click(within(pane).getByRole("button", { name: /^Order 1 unit to reinforce/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("That route is closed now.");
    expect(first).toBeChecked();
    expect(dispatched).not.toHaveBeenCalledWith(expect.objectContaining({ type: "game/orderFromMuster" }));
  });
});
