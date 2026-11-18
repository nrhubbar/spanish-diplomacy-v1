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
    expect(screen.getByRole("button", { name: "Settings" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Create Game" }));
    expect(screen.getByRole("heading", { name: "Choose the commanders" })).toBeVisible();
    expect(screen.getAllByRole("combobox")).toHaveLength(3);
    expect(screen.getAllByRole("option", { name: /Remote player/ }).every((option) => option.hasAttribute("disabled"))).toBe(true);
    expect(screen.queryByText(/researched game-scale interpretation/)).not.toBeInTheDocument();
  });

  it("opens settings from home and returns", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeVisible();
    expect(screen.getByText(/W, A, S, and D/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back to home" }));
    expect(screen.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
  });

  it("starts the default mixed game without a handoff screen", async () => {
    const user = userEvent.setup();
    renderApp("/setup");
    await user.click(screen.getByRole("button", { name: "Start Campaign" }));
    expect(screen.getByRole("heading", { name: "Republican Government" })).toBeVisible();
    expect(screen.getByLabelText("Iberia campaign map")).toBeVisible();
    expect(screen.getByText("Madrid", { selector: "text" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Exit game" }));
    expect(screen.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
  });

  it("selects formations independently, adds a move, and resolves with computer players", async () => {
    const user = userEvent.setup();
    renderApp("/setup");
    await user.click(screen.getByRole("button", { name: "Start Campaign" }));
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
    expect(screen.getByRole("heading", { name: "Republican Government" })).toBeVisible();
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

  it("runs an all-computer turn automatically", async () => {
    const user = userEvent.setup();
    renderApp("/setup");
    for (const select of screen.getAllByRole("combobox")) await user.selectOptions(select, "computer");
    await user.click(screen.getByRole("button", { name: "Start Campaign" }));
    expect(screen.getByRole("heading", { name: "Turn resolution" })).toBeVisible();
  });

  it("guards routes and renders notifications", async () => {
    const user = userEvent.setup();
    const store = renderApp("/orders");
    expect(screen.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
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
    expect(screen.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
    cleanup();
    renderApp("/resolution");
    expect(screen.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
    cleanup();
    renderApp("/game-over");
    expect(screen.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
  });

  it("routes every screen away from phases it cannot display", () => {
    const cases = [
      ["/handoff", "planning"],
      ["/handoff", "resolution"],
      ["/handoff", "game-over"],
      ["/handoff", "setup"],
      ["/orders", "handoff"],
      ["/orders", "resolution"],
      ["/orders", "game-over"],
      ["/orders", "setup"],
      ["/resolution", "handoff"],
      ["/resolution", "game-over"],
      ["/resolution", "setup"]
    ] as const;

    for (const [path, phase] of cases) {
      const base = createAppStore().getState();
      const resolution = phase === "resolution"
        ? resolveTurn(milestone2Scenario, createInitialGameState(), [])
        : undefined;
      renderApp(path, createAppStore({ game: { ...base.game, phase, resolution } }));
      expect(document.body.textContent).not.toBe("");
      cleanup();
    }

    const base = createAppStore().getState();
    renderApp("/handoff", createAppStore({
      game: {
        ...base.game,
        assignments: { republic: "computer", north: "computer", south: "computer" },
        phase: "handoff"
      }
    }));
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
    const outcomes = [
      { kind: "bounced-move", order: orders[0]!, reason: "opposed" },
      { kind: "disbanded-move", order: { ...orders[0]!, unitId: "removed-unit" }, reason: "overwhelmed" },
      { kind: "invalid-order", order: { ...orders[0]!, unitId: "invalid-unit" }, reason: "invalid" },
      { factionId: "north", kind: "no-move", unitId: "holding-unit" }
    ] as const;
    render(<IberiaMap cities={milestone2Scenario.cities} cityControl={{}} control={state.control} factions={milestone2Scenario.factions} legalDestinationIds={["castilla-la-mancha"]} onSelectTerritory={onSelectTerritory} onSelectUnit={onSelectUnit} plannedOrders={orders} resolutionOutcomes={outcomes} selectedDestinationId="castilla-la-mancha" selectedFromTerritoryId="madrid" selectedUnitIds={["rep-wad-ras-1"]} units={[state.units["rep-wad-ras-1"]!]} />);
    expect(screen.getByText("Barcelona", { selector: ".map-city text" })).toBeInTheDocument();
    expect(screen.getByText("France", { selector: ".iberia-country-label text" })).toBeInTheDocument();
    expect(screen.getByText("Morocco", { selector: ".iberia-country-label text" })).toBeInTheDocument();
    expect(screen.getByLabelText("Iberia campaign map")).toHaveAttribute("data-semantic-level", "overview");
    expect(document.getElementById("ES53")).toHaveStyle("--region-color: var(--territory-islas-baleares-color)");
    expect(screen.getByLabelText("Iberia campaign map").getAttribute("style")).toContain("--territory-islas-baleares-color: #9a7e69");
    expect(screen.getByRole("button", { name: "Madrid" })).toHaveAttribute("data-selected-origin", "true");
    expect(screen.getByRole("button", { name: "Castilla-La Mancha" })).toHaveAttribute("data-selected-destination", "true");
    fireEvent.keyDown(screen.getByRole("button", { name: "Madrid" }), { key: "Enter" });
    expect(onSelectTerritory).toHaveBeenCalledWith("madrid");
    fireEvent.keyDown(screen.getByRole("button", { name: "Madrid" }), { key: "Escape" });
    fireEvent.click(screen.getByLabelText("Iberia campaign map"));
    expect(onSelectTerritory).toHaveBeenCalledTimes(1);
    fireEvent.click(document.querySelector(".iberia-map-terrain") as Element);
    expect(onSelectTerritory).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Wad-Ras Infantry Regiment No. 1/ })).toBeDisabled();
    expect(document.querySelector(".map-planned-order-arrow")).toBeInTheDocument();
    expect(document.querySelector(".map-bounce-icon, .map-disband-icon")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("Map zoom 125 percent")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByLabelText("Iberia campaign map"), { key: "+" });
    expect(screen.getByText("Map zoom 150 percent")).toBeInTheDocument();
    expect(screen.getByLabelText("Iberia campaign map")).toHaveAttribute("data-semantic-level", "operational");
    expect(document.querySelector(".map-bounce-icon")?.getAttribute("transform")).toContain("scale(0.617");
    fireEvent.keyDown(screen.getByLabelText("Iberia campaign map"), { key: "w" });
    fireEvent.wheel(screen.getByLabelText("Iberia campaign map"), { clientX: 20, clientY: 20, deltaY: 100 });
    fireEvent.keyDown(screen.getByLabelText("Iberia campaign map"), { key: "0" });
    expect(screen.getByText("Map zoom 100 percent")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByLabelText("Iberia campaign map"), { key: "-" });
    fireEvent.keyDown(screen.getByLabelText("Iberia campaign map"), { key: "Escape" });
    fireEvent.keyDown(screen.getByLabelText("Iberia campaign map"), { key: "Enter" });
    for (let step = 0; step < 8; step += 1) fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
    for (let step = 0; step < 8; step += 1) fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
  });

  it("selects an available map counter", () => {
    const state = createInitialGameState();
    const onSelectUnit = vi.fn();
    render(<IberiaMap control={state.control} factions={milestone2Scenario.factions} legalDestinationIds={[]} onSelectTerritory={() => undefined} onSelectUnit={onSelectUnit} selectedDestinationId={undefined} selectedFromTerritoryId={undefined} selectedUnitIds={[]} units={[state.units["rep-wad-ras-1"]!]} />);
    fireEvent.click(screen.getByRole("button", { name: /Wad-Ras Infantry Regiment No. 1/ }));
    expect(onSelectUnit).toHaveBeenCalledWith("rep-wad-ras-1");
  });
});
