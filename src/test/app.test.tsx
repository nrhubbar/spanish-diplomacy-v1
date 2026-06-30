import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../main/app";
import { AbstractMap } from "../main/components/AbstractMap";
import type { UnitState } from "../main/engine/types";
import { milestone1Scenario } from "../main/scenarios/milestone1Scenario";
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
    await user.click(screen.getByRole("button", { name: "North" }));
    await user.click(screen.getByRole("button", { name: "Move" }));
    await user.click(screen.getByRole("button", { name: "Center" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByRole("heading", { name: "Player 2 Order Submission" })).toBeVisible();
    expect(screen.getByText("Player 1 submitted orders.")).toBeVisible();
  });

  it("runs the full first turn and starts the next turn", async () => {
    const user = userEvent.setup();
    renderWithStore();

    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: "Create Local Game" }));
    await user.click(screen.getByRole("button", { name: "North" }));
    await user.click(screen.getByRole("button", { name: "Move" }));
    await user.click(screen.getByRole("button", { name: "Center" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await user.click(screen.getByRole("button", { name: "Southwest" }));
    await user.click(screen.getByRole("button", { name: "Move" }));
    await user.click(screen.getByRole("button", { name: "Center" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByRole("heading", { name: "Resolution Summary" })).toBeVisible();
    expect(screen.getByText(/com bounced com-inf-001 moving from north to center/)).toBeVisible();
    expect(screen.getByText("Player 3: No orders")).toBeVisible();

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
    const onSelectUnit = vi.fn();
    const units: readonly UnitState[] = [
      {
        displayName: "1st International Infantry",
        factionId: "com",
        id: "com-inf-001",
        type: "infantry",
        territoryId: "center"
      },
      {
        displayName: "1st Royal Infantry",
        factionId: "roy",
        id: "roy-inf-001",
        type: "infantry",
        territoryId: "center"
      }
    ];

    render(
      <AbstractMap
        control={{ center: "com" }}
        factions={milestone1Scenario.factions}
        legalDestinationIds={["north"]}
        onSelectUnit={onSelectUnit}
        onSelectTerritory={onSelectTerritory}
        selectedDestinationId="north"
        selectedFromTerritoryId="center"
        selectedUnitIds={["com-inf-001"]}
        units={units}
      />
    );

    expect(screen.getByLabelText("Milestone 1 territory map")).toBeVisible();
    expect(screen.getByRole("button", { name: "1st International Infantry" })).toBeVisible();
    expect(screen.getByRole("button", { name: "North" })).toHaveClass("map-territory-destination");

    await user.click(screen.getByRole("button", { name: "North" }));
    await user.click(screen.getByRole("button", { name: "1st International Infantry" }));

    expect(onSelectTerritory).toHaveBeenCalledWith("north");
    expect(onSelectUnit).toHaveBeenCalledWith("com-inf-001");
  });

  it("supports keyboard territory selection", () => {
    const onSelectTerritory = vi.fn();

    render(
      <AbstractMap
        control={{}}
        factions={milestone1Scenario.factions}
        legalDestinationIds={[]}
        onSelectUnit={vi.fn()}
        onSelectTerritory={onSelectTerritory}
        selectedDestinationId={undefined}
        selectedFromTerritoryId={undefined}
        selectedUnitIds={[]}
        units={[]}
      />
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "Center" }), { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Southwest" }), { key: " " });
    fireEvent.keyDown(screen.getByRole("button", { name: "North" }), { key: "Escape" });

    expect(onSelectTerritory).toHaveBeenCalledWith("center");
    expect(onSelectTerritory).toHaveBeenCalledWith("southwest");
    expect(onSelectTerritory).toHaveBeenCalledTimes(2);
  });
});
