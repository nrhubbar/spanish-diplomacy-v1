import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it } from "vitest";
import { ResourceChips } from "../../main/components/header/ResourceChips";
import { initialGameState } from "../../main/engine/resolution";
import type { FactionId, GameState, Scenario, SubTerritoryId, UnitTypeId } from "../../main/engine/types";
import { RegistryContext } from "../../main/hooks";
import type { PlanningSession } from "../../main/state/planning";
import { emptyDraft, type Draft } from "../../main/state/session";
import { faction, spain, spainId, territory, testRegistry, testStore } from "../support";

afterEach(cleanup);

const republic = faction("republic");

function renderChips(state: GameState, options: { readonly draft?: Draft; readonly scenario?: Scenario; readonly viewer?: FactionId | undefined } = {}) {
  const session: PlanningSession = { draft: options.draft ?? emptyDraft, factionId: republic, game: { assignments: { [republic]: "local-human" }, history: [], locked: {}, scenarioId: spainId, seed: 1, state }, phase: "planning" };
  const store = testStore({ game: { session } });
  const user = userEvent.setup();
  const viewer = "viewer" in options ? options.viewer : republic;
  const { container } = render(
    <Provider store={store}>
      <RegistryContext value={testRegistry()}>
        <ResourceChips scenario={options.scenario ?? spain()} state={state} {...(viewer === undefined ? {} : { viewer })} />
      </RegistryContext>
    </Provider>
  );
  return { container, user };
}

describe("the resource chips (X1, EB-12)", () => {
  const scenario = spain();
  const start = initialGameState(scenario);

  it("shows each resource's balance and next turn's income through its display scale", () => {
    renderChips(start);
    const funds = screen.getByRole("button", { name: /^Funds 40 \+\d+ ?next turn$/u });
    expect(funds).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^Manpower 10k \+\d+k ?next turn$/u })).toBeTruthy();
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("opens a chip's detail: where the income comes from and the other factions' hidden balances", async () => {
    const hidden: GameState = { ...start, treasuries: { [republic]: start.treasuries[republic]! } };
    const { user } = renderChips(hidden);
    await user.click(screen.getByRole("button", { name: /^Funds /u }));
    const detail = screen.getByRole("region", { name: "Funds detail" });
    expect(detail.querySelector("strong")?.textContent).toBe("Funds: 40");
    // Funds have no display unit, so no amount in full.
    expect(detail.querySelector("p")?.textContent).toBe("Funds: 40");
    expect(detail.textContent).toMatch(/Next turn \+\d+ from \d+ territories held whole\./u);
    expect(detail.textContent).toMatch(/\d+ contested territories pay nothing\./u);
    expect(detail.textContent).not.toContain("This turn's orders spend");
    const others = within(detail).getByRole("list", { name: "Other factions" });
    expect(within(others).getAllByText("hidden")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: /^Funds /u }));
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("reads Manpower in full, recon-revealed balances, and this turn's spending", async () => {
    const draft: Draft = { ...emptyDraft, recruits: [{ factionId: republic, kind: "recruit", territoryId: territory("madrid"), unitTypeId: "militia-column" as UnitTypeId }] };
    const { user } = renderChips(start, { draft });
    expect(screen.getByRole("button", { name: /^Manpower 7k /u })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /^Manpower /u }));
    const detail = screen.getByRole("region", { name: "Manpower detail" });
    expect(detail.querySelector("p")?.textContent).toBe("Manpower: 10k (10,000)");
    expect(detail.textContent).toContain("This turn's orders spend 3k when revealed.");
    expect(within(detail).getAllByText(/^\d+k \(recon\)$/u)).toHaveLength(2);
  });

  it("names a raid's cut, one territory held whole and one contested", async () => {
    const madrid = "madrid" as SubTerritoryId;
    const onlyMadrid: GameState = {
      ...start,
      raidCuts: [{ factionId: faction("republic"), subTerritoryId: madrid, turnNumber: start.turnNumber }],
      subTerritories: Object.fromEntries(Object.entries(start.subTerritories).map(([id, site]) => {
        const entry = scenario.index.subTerritories.get(id as SubTerritoryId);
        if (entry?.territoryId === "madrid" || entry?.territoryId === "andalucia") return [id, site];
        return [id, { ...site, holder: faction("north") }];
      }))
    };
    const { user } = renderChips(onlyMadrid);
    await user.click(screen.getByRole("button", { name: /^Funds /u }));
    const detail = screen.getByRole("region", { name: "Funds detail" });
    expect(detail.textContent).toMatch(/from 1 territory held whole\./u);
    expect(detail.textContent).toMatch(/Raids cut \d+\./u);
    expect(detail.textContent).toContain("1 contested territory pays nothing.");
  });

  it("renders nothing without a viewer, without the economy, or without the viewer's treasury", () => {
    expect(renderChips(start, { viewer: undefined }).container.querySelector(".resource-chip")).toBeNull();
    cleanup();
    expect(renderChips(start, { scenario: { ...scenario, rules: { ...scenario.rules, economy: "none" } } }).container.querySelector(".resource-chip")).toBeNull();
    cleanup();
    expect(renderChips({ ...start, treasuries: {} }).container.querySelector(".resource-chip")).toBeNull();
  });
});
