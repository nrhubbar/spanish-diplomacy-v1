import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../main/app";
import { AbstractMap } from "../main/components/AbstractMap";
import type { UnitState } from "../main/engine/types";
import { addInfoNotification } from "../main/state/notificationSlice";
import { createAppStore } from "../main/state/store";

function renderWithStore(
  initialPath = "/",
  store: ReturnType<typeof createAppStore> = createAppStore()
): ReturnType<typeof createAppStore> {

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </Provider>
  );

  return store;
}

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  it("starts on the main screen", () => {
    renderWithStore();

    expect(screen.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Start" })).toBeVisible();
  });

  it("opens setup from the start button", async () => {
    const user = userEvent.setup();
    renderWithStore();

    await user.click(screen.getByRole("button", { name: "Start" }));

    expect(screen.getByRole("heading", { name: "Milestone 1 Setup" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Create Local Game" })).toBeVisible();
  });

  it("creates a local game and opens player 1 order submission", async () => {
    const user = userEvent.setup();
    renderWithStore();

    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: "Create Local Game" }));

    expect(screen.getByRole("heading", { name: "Player 1 Order Submission" })).toBeVisible();
    expect(screen.getByLabelText("Milestone 1 territory map")).toBeVisible();
  });

  it("submits a first player move and advances to player 2", async () => {
    const user = userEvent.setup();
    renderWithStore();

    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: "Create Local Game" }));
    await user.click(screen.getByRole("button", { name: "Center" }));
    await user.click(screen.getByRole("button", { name: "Submit Move" }));

    expect(screen.getByRole("heading", { name: "Player 2 Order Submission" })).toBeVisible();
    expect(screen.getByText("Player 1: Move from North to Center")).toBeVisible();
  });

  it("runs the full first turn and starts the next turn", async () => {
    const user = userEvent.setup();
    renderWithStore();

    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: "Create Local Game" }));
    await user.click(screen.getByRole("button", { name: "Center" }));
    await user.click(screen.getByRole("button", { name: "Submit Move" }));
    await user.click(screen.getByRole("button", { name: "Center" }));
    await user.click(screen.getByRole("button", { name: "Submit Move" }));
    await user.click(screen.getByRole("button", { name: "Submit No Move" }));

    expect(screen.getByRole("heading", { name: "Resolution Summary" })).toBeVisible();
    expect(screen.getByText(/player-1 bounced moving from north to center/)).toBeVisible();
    expect(screen.getByText("Player 3: No move")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Start Next Turn" }));

    expect(screen.getByRole("heading", { name: "Player 1 Order Submission" })).toBeVisible();
  });

  it("guards order and resolution routes before a game is ready", () => {
    renderWithStore("/orders");
    expect(screen.getByRole("heading", { name: "Milestone 1 Setup" })).toBeVisible();

    cleanup();

    renderWithStore("/resolution");
    expect(screen.getByRole("heading", { name: "Milestone 1 Setup" })).toBeVisible();
  });

  it("redirects unknown routes to the start screen", () => {
    renderWithStore("/missing");

    expect(screen.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
  });

  it("shows and dismisses app notifications", async () => {
    const user = userEvent.setup();
    const store = renderWithStore();

    act(() => {
      store.dispatch(addInfoNotification("Orders saved."));
    });

    expect(await screen.findByLabelText("Notifications")).toBeVisible();
    expect(screen.getByText("Orders saved.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText("Orders saved.")).not.toBeInTheDocument();
  });
});

describe("AbstractMap", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders territories, unit counts, and selection callbacks", async () => {
    const user = userEvent.setup();
    const onSelectTerritory = vi.fn();
    const units: readonly UnitState[] = [
      { id: "soldier-1", factionId: "player-1", type: "soldier", territoryId: "center" },
      { id: "soldier-2", factionId: "player-2", type: "soldier", territoryId: "center" }
    ];

    render(
      <AbstractMap
        legalDestinationIds={["north"]}
        onSelectTerritory={onSelectTerritory}
        selectedDestinationId="north"
        selectedTerritoryId="center"
        units={units}
      />
    );

    expect(screen.getByLabelText("Milestone 1 territory map")).toBeVisible();
    expect(screen.getByText("2 soldiers")).toBeVisible();
    expect(screen.getByRole("button", { name: "North" })).toHaveClass("map-territory-destination");

    await user.click(screen.getByRole("button", { name: "North" }));

    expect(onSelectTerritory).toHaveBeenCalledWith("north");
  });
});
