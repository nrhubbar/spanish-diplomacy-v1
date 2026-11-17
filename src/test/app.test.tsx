import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../main/app";
import { IberiaMap } from "../main/components/IberiaMap";
import { resolveTurn } from "../main/engine/resolution";
import { createInitialGameState, milestone2Scenario } from "../main/scenarios/milestone2Scenario";
import { addInfoNotification } from "../main/state/notificationSlice";
import { createAppStore } from "../main/state/store";

function renderApp(initialPath = "/", store = createAppStore()) {
  render(<Provider store={store}><MemoryRouter initialEntries={[initialPath]}><App /></MemoryRouter></Provider>);
  return store;
}

describe("Milestone 2 application flow", () => {
  afterEach(cleanup);

  it("opens the faction assignment screen", async () => {
    const user = userEvent.setup();
    renderApp();
    expect(screen.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Set Up Campaign" }));
    expect(screen.getByRole("heading", { name: "Choose the commanders" })).toBeVisible();
    expect(screen.getAllByRole("combobox")).toHaveLength(3);
    expect(screen.getAllByRole("option", { name: /Online Player/ }).every((option) => option.hasAttribute("disabled"))).toBe(true);
  });

  it("starts the default mixed game behind a privacy handoff", async () => {
    const user = userEvent.setup();
    renderApp("/setup");
    await user.click(screen.getByRole("button", { name: "Start Campaign" }));
    expect(screen.getByRole("heading", { name: /Pass to Republican Government/ })).toBeVisible();
    expect(screen.queryByLabelText("Iberia campaign map")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Begin Republican Government Orders/ }));
    expect(screen.getByRole("heading", { name: "Republican Government" })).toBeVisible();
    expect(screen.getByLabelText("Iberia campaign map")).toBeVisible();
    expect(screen.getByText("Madrid", { selector: "text" })).toBeInTheDocument();
  });

  it("selects formations independently, adds a move, and resolves with computer players", async () => {
    const user = userEvent.setup();
    renderApp("/setup");
    await user.click(screen.getByRole("button", { name: "Start Campaign" }));
    await user.click(screen.getByRole("button", { name: /Begin Republican Government Orders/ }));
    await user.click(screen.getByRole("button", { name: "Madrid" }));
    await user.click(screen.getAllByRole("button", { name: /Wad-Ras Infantry Regiment/ })[1]!);
    await user.click(screen.getByRole("button", { name: "Move selected" }));
    await user.click(screen.getByRole("button", { name: "Castilla-La Mancha" }));
    await user.click(screen.getByRole("button", { name: "Add Move" }));
    expect(screen.getByText(/Wad-Ras Infantry Regiment No. 1 → Castilla-La Mancha/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Submit Orders" }));
    expect(screen.getByRole("heading", { name: "Turn resolution" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Victory progress" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Start Next Turn" }));
    expect(screen.getByRole("heading", { name: /Pass to Republican Government/ })).toBeVisible();
  });

  it("shows a private handoff between two local players", async () => {
    const user = userEvent.setup();
    renderApp("/setup");
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[1]!, "local-human");
    await user.click(screen.getByRole("button", { name: "Start Campaign" }));
    await user.click(screen.getByRole("button", { name: /Begin Republican Government Orders/ }));
    await user.click(screen.getByRole("button", { name: "Submit Orders" }));
    expect(screen.getByRole("heading", { name: /Pass to Northern Insurgent Command/ })).toBeVisible();
    expect(screen.queryByText(/All formations held/)).not.toBeInTheDocument();
  });

  it("runs an all-computer turn only when requested", async () => {
    const user = userEvent.setup();
    renderApp("/setup");
    for (const select of screen.getAllByRole("combobox")) await user.selectOptions(select, "computer");
    await user.click(screen.getByRole("button", { name: "Start Campaign" }));
    expect(screen.getByRole("button", { name: "Run Computer Turn" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Run Computer Turn" }));
    expect(screen.getByRole("heading", { name: "Turn resolution" })).toBeVisible();
  });

  it("guards routes and renders notifications", async () => {
    const user = userEvent.setup();
    const store = renderApp("/orders");
    expect(screen.getByRole("heading", { name: "Choose the commanders" })).toBeVisible();
    act(() => { store.dispatch(addInfoNotification("Orders saved.")); });
    expect(screen.getByText("Orders saved.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Orders saved.")).not.toBeInTheDocument();
  });

  it.each([
    ["cities", "Republican Government wins", "decisive cities"],
    ["territories", "Republican Government wins", "territorial control"],
    ["shared", "Republican Government and Northern Insurgent Command share victory", "equal control"]
  ] as const)("renders the terminal %s result", (condition, heading, explanation) => {
    const base = createAppStore().getState();
    const engine = createInitialGameState();
    const resolved = resolveTurn(milestone2Scenario, engine, []);
    const factionIds = condition === "shared" ? ["republic", "north"] as const : ["republic"] as const;
    const store = createAppStore({
      game: {
        ...base.game,
        cityControl: engine.cityControl,
        control: engine.control,
        phase: "game-over",
        resolution: { ...resolved, victory: { condition, factionIds } },
        units: engine.units
      }
    });
    renderApp("/game-over", store);
    expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    expect(screen.getByText(new RegExp(explanation))).toBeVisible();
    expect(screen.queryByRole("button", { name: "Start Next Turn" })).not.toBeInTheDocument();
  });

  it("redirects invalid handoff, resolution, and game-over routes", () => {
    renderApp("/handoff");
    expect(screen.getByRole("heading", { name: "Choose the commanders" })).toBeVisible();
    cleanup();
    renderApp("/resolution");
    expect(screen.getByRole("heading", { name: "Choose the commanders" })).toBeVisible();
    cleanup();
    renderApp("/game-over");
    expect(screen.getByRole("heading", { name: "Choose the commanders" })).toBeVisible();
  });
});

describe("IberiaMap interaction and annotations", () => {
  afterEach(cleanup);

  it("supports keyboard selection, background clicks, city labels, and resolution markers", () => {
    const state = createInitialGameState();
    const onSelectTerritory = vi.fn();
    const onSelectUnit = vi.fn();
    const orders = [
      { factionId: "republic", from: "madrid", kind: "move", to: "castilla-la-mancha", unitId: "rep-wad-ras-1" } as const
    ];
    const result = resolveTurn(milestone2Scenario, state, [{ factionId: "republic", orders }]);
    render(<IberiaMap cities={milestone2Scenario.cities} cityControl={{}} control={state.control} factions={milestone2Scenario.factions} legalDestinationIds={["castilla-la-mancha"]} onSelectTerritory={onSelectTerritory} onSelectUnit={onSelectUnit} resolutionOutcomes={result.outcomes} selectedDestinationId="castilla-la-mancha" selectedFromTerritoryId="madrid" selectedUnitIds={["rep-wad-ras-1"]} units={[state.units["rep-wad-ras-1"]!]} />);
    expect(screen.getByText("Barcelona", { selector: ".map-city text" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Madrid" }), { key: "Enter" });
    expect(onSelectTerritory).toHaveBeenCalledWith("madrid");
    fireEvent.keyDown(screen.getByRole("button", { name: "Madrid" }), { key: "Escape" });
    fireEvent.click(screen.getByLabelText("Iberia campaign map"));
    expect(onSelectTerritory).toHaveBeenCalledTimes(1);
    fireEvent.click(document.getElementById("PT11") as Element);
    expect(onSelectTerritory).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Wad-Ras Infantry Regiment No. 1" }));
    expect(onSelectUnit).toHaveBeenCalledWith("rep-wad-ras-1");
  });
});
