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
import { faction, spain, spainId, territory, testRegistry, testStore, testGame } from "../support";

afterEach(cleanup);

const republic = faction("republic");

function renderChips(state: GameState, options: { readonly draft?: Draft; readonly scenario?: Scenario; readonly viewer?: FactionId | undefined } = {}) {
  const session: PlanningSession = { draft: options.draft ?? emptyDraft, factionId: republic, game: { assignments: { [republic]: "local-human" }, history: [], ready: [], scenarioId: spainId, gameId: testGame, state }, phase: "planning" };
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
    const funds = screen.getByRole("button", { name: /^Funds 40 \+[\d.]+ ?next turn$/u });
    expect(funds).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^Manpower 10k \+[\d.]+k ?next turn$/u })).toBeTruthy();
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("opens a chip's balance view: territory rows, expense rows, a total equal to the chip, and the other factions' hidden balances", async () => {
    const hidden: GameState = { ...start, treasuries: { [republic]: start.treasuries[republic]! } };
    const { user } = renderChips(hidden);
    const chip = screen.getByRole("button", { name: /^Funds /u });
    const next = chip.querySelector(".resource-income")?.textContent;
    await user.click(chip);
    const detail = screen.getByRole("region", { name: "Funds detail" });
    expect(detail.querySelector("strong")?.textContent).toBe(`Funds: 40 now \u00b7 ${String(next)} next turn`);
    const table = within(detail).getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows.at(-1)?.textContent).toBe(`Next turn${String(next)}`);
    expect(within(table).getByRole("rowheader", { name: /^Builds under way/u }).textContent).toBe("Builds under way none");
    expect(within(table).getByRole("rowheader", { name: /^Replenish/u }).textContent).toBe("Replenish none planned");
    expect(within(table).getByRole("rowheader", { name: /^Upkeep/u }).textContent).toBe("Upkeep 17 units");
    // A contested territory's loss is on its own row, which pays nothing.
    const contested = rows.find((row) => row.getAttribute("data-contested") === "true");
    expect(contested?.querySelector(".ledger-loss")?.textContent).toMatch(/^ \u2212[\d.]+ contested$/u);
    expect(contested?.querySelector(".ledger-value")?.textContent).toBe("+0");
    expect(detail.textContent).toContain("You hold 40.");
    expect(detail.textContent).not.toContain("This turn's Build and Recruit orders spend");
    const others = within(detail).getByRole("list", { name: "Other factions" });
    expect(within(others).getAllByText("hidden")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: /^Funds /u }));
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("reads Manpower in full, recon-revealed balances, and this turn's Recruit orders on the balance", async () => {
    const draft: Draft = { ...emptyDraft, recruits: [{ factionId: republic, kind: "recruit", territoryId: territory("madrid"), unitTypeId: "militia-column" as UnitTypeId }] };
    const { user } = renderChips(start, { draft });
    expect(screen.getByRole("button", { name: /^Manpower 7k /u })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /^Manpower /u }));
    const detail = screen.getByRole("region", { name: "Manpower detail" });
    expect(detail.textContent).toContain("This turn's Build and Recruit orders spend 3k of the 10k (10,000) you hold.");
    expect(within(detail).getAllByText(/^\d+k \(recon\)$/u)).toHaveLength(2);
  });

  it("takes this turn's Replenish orders off next turn, so the total still matches the chip", async () => {
    const worn = Object.values(start.units).find((unit) => unit.factionId === republic && unit.territoryId === territory("madrid"))!;
    const state: GameState = { ...start, units: { ...start.units, [worn.id]: { ...worn, strength: 1 } } };
    const plain = renderChips(state);
    const before = Number(plain.container.querySelector(".resource-income")?.textContent.replace("+", ""));
    cleanup();
    const draft: Draft = { ...emptyDraft, replenishments: [{ factionId: republic, kind: "replenish", unitId: worn.id }] };
    const { container, user } = renderChips(state, { draft });
    const chip = screen.getByRole("button", { name: /^Funds /u });
    // The balance keeps the 40: the Replenish comes off the next-turn figure.
    expect(chip.querySelector(".resource-balance")?.textContent).toBe("40");
    const after = container.querySelector(".resource-income")?.textContent ?? "";
    expect(Number(after.replace("\u2212", "-").replace("+", ""))).toBeLessThan(before);
    await user.click(chip);
    const table = within(screen.getByRole("region", { name: "Funds detail" })).getByRole("table");
    expect(within(table).getByRole("rowheader", { name: /^Replenish/u }).textContent).toBe("Replenish 1 unit, planned this turn");
    expect(within(table).getAllByRole("row").at(-1)?.textContent).toBe(`Next turn${after}`);
  });

  it("puts a raid's cut on its own row, with one territory held whole and one contested", async () => {
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
    const next = screen.getByRole("button", { name: /^Funds /u }).querySelector(".resource-income")?.textContent;
    await user.click(screen.getByRole("button", { name: /^Funds /u }));
    const table = within(screen.getByRole("region", { name: "Funds detail" })).getByRole("table");
    const heads = within(table).getAllByRole("rowheader").map((head) => head.textContent);
    expect(heads[0]).toBe("Madrid");
    expect(heads).toContain("Raids cut for a turn");
    expect(heads.some((head) => /^Andaluc\u00eda \d+\/\d+ held$/u.test(head))).toBe(true);
    const values = within(table).getAllByRole("row").slice(0, -1).filter((row) => row.getAttribute("data-kind") !== "line").map((row) => Number(row.querySelector(".ledger-value")?.textContent.replace("\u2212", "-")));
    const sum = values.reduce((total, value) => total + value, 0);
    expect(sum < 0 ? `\u2212${String(Math.abs(sum))}` : `+${String(sum)}`).toBe(next);
  });

  it("renders nothing without a viewer, without the economy, or without the viewer's treasury", () => {
    expect(renderChips(start, { viewer: undefined }).container.querySelector(".resource-chip")).toBeNull();
    cleanup();
    expect(renderChips(start, { scenario: { ...scenario, rules: { ...scenario.rules, economy: "none" } } }).container.querySelector(".resource-chip")).toBeNull();
    cleanup();
    expect(renderChips({ ...start, treasuries: {} }).container.querySelector(".resource-chip")).toBeNull();
  });
});
