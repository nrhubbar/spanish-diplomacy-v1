import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it } from "vitest";
import { Ledger } from "../../main/components/header/Ledger";
import { initialGameState } from "../../main/engine/resolution";
import type { GameState, ResourceId, Scenario, UnitState, UnitTypeId } from "../../main/engine/types";
import { RegistryContext } from "../../main/hooks";
import { useSession } from "../../main/hooks";
import { ledgersFor } from "../../main/presentation/ledger";
import { unitName } from "../../main/presentation/text";
import { ArmyPicker } from "../../main/screens/ArmyPicker";
import { AircraftDisband } from "../../main/screens/pane/DisbandControls";
import { ShortageWarning } from "../../main/screens/pane/ShortageWarning";
import type { PlanningSession } from "../../main/state/planning";
import { SelectionBar } from "../../main/screens/shell/SelectionBar";
import { type Draft, emptyDraft } from "../../main/state/session";
import { createAppStore } from "../../main/state/store";
import { faction, shippedRegistry, spainId, spainWithAir, withoutUpkeep } from "../support";

afterEach(cleanup);

const scenario = spainWithAir();
const republic = faction("republic");
const initial = initialGameState(scenario);
const kindOf = (unit: UnitState): string | undefined => scenario.index.unitTypes.get(scenario.index.units.get(unit.id)?.type ?? ("" as UnitTypeId))?.kind;
const unitOf = (kind: string): UnitState => Object.values(initial.units).find((unit) => unit.factionId === republic && kindOf(unit) === kind)!;
const infantry = unitOf("ground");
const planning = (state: GameState = initial): PlanningSession => ({
  draft: emptyDraft, factionId: republic, game: { assignments: { [republic]: "local-human" }, history: [], locked: {}, scenarioId: spainId, seed: 1, state }, phase: "planning"
});

const general = unitOf("general");
const inMadrid = Object.values(initial.units).filter((unit) => unit.factionId === republic && unit.territoryId === infantry.territoryId && kindOf(unit) === "ground");

function Live({ children }: { readonly children: (session: PlanningSession) => ReactNode }) {
  const session = useSession();
  return session.phase === "planning" ? children(session) : null;
}

function renderLive(children: (session: PlanningSession) => ReactNode, selected: readonly UnitState[] = []) {
  const draft: Draft = { ...emptyDraft, selectedTerritoryId: infantry.territoryId, selectedUnitIds: selected.map(({ id }) => id) };
  const store = createAppStore({ preloadedState: { game: { session: { ...planning(), draft } } }, registry: shippedRegistry() });
  render(<Provider store={store}><RegistryContext value={shippedRegistry()}><Live>{children}</Live></RegistryContext></Provider>);
  const current = () => { const { session } = store.getState().game; return session.phase === "planning" ? session.draft : emptyDraft; };
  return { draft: current, store, user: userEvent.setup() };
}

const picker = (session: PlanningSession) => <ArmyPicker own={[...inMadrid, general]} scenario={scenario} session={session} />;

describe("Disband for the selected units (D1, N1)", () => {
  it("is one order for several units, from the button after the list, with one confirm step", async () => {
    const units = inMadrid.slice(0, 3);
    const { draft, user } = renderLive(picker, units);
    const button = screen.getByRole("button", { name: "Order for 3 selected units" });
    await user.click(button);
    const menu = screen.getByRole("group", { name: "Order for 3 selected units" });
    expect(document.activeElement).toBe(within(menu).getAllByRole("button")[0]);
    await user.click(within(menu).getByRole("button", { name: "Disband" }));
    expect(screen.getByText(/^Disband 3 units\? Saves [\d.]+ Funds and [\d.]+k Manpower a turn together\.$/u)).toBeVisible();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep" }));
    await user.click(screen.getByRole("button", { name: "Keep" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Disband" }));
    expect(draft().disbands ?? []).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Disband" }));
    await user.click(screen.getByRole("button", { name: "Disband" }));
    expect(draft().disbands).toEqual(units.map(({ id }) => ({ factionId: republic, kind: "disband", unitId: id })));
    expect(draft().feedback).toBe("3 units will disband at the end of the turn.");
    const waiting = screen.getByRole("button", { name: "Select units first" });
    expect(document.activeElement).toBe(waiting);
    expect(waiting.getAttribute("aria-disabled")).toBe("true");
    await user.click(waiting);
    expect(screen.queryByRole("button", { name: "Disband" })).toBeNull();
    // Each card says so, and takes its own unit back.
    expect(screen.getAllByText("Goes home at the end of the turn.")).toHaveLength(3);
    const first = screen.getByRole("group", { name: `Disband ${unitName(scenario, units[0]!.id)}` });
    const card = first.closest("li")!.querySelector("button");
    await user.click(within(first).getByRole("button", { name: "Keep" }));
    expect(draft().disbands).toHaveLength(2);
    expect(document.activeElement).toBe(card);
  });

  it("closes on Escape, on a click outside and when focus leaves", async () => {
    const { user } = renderLive(picker, inMadrid.slice(0, 1));
    const open = () => user.click(screen.getByRole("button", { name: "Order for 1 selected unit" }));
    const menu = () => screen.queryByRole("group", { name: "Order for 1 selected unit" });
    await open();
    await user.keyboard("a");
    expect(menu()).not.toBeNull();
    await user.keyboard("{Escape}");
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Order for 1 selected unit" }));
    await open();
    await user.click(document.body);
    expect(menu()).toBeNull();
    await open();
    await user.tab();
    expect(menu()).not.toBeNull();
    act(() => { screen.getByRole("button", { name: "Select all" }).focus(); });
    expect(menu()).toBeNull();
    await open();
    await open();
    expect(menu()).toBeNull();
  });

  it("leaves the general of a selection out, is not offered for him alone, and has no block of its own on the cards", async () => {
    renderLive(picker, [infantry, general]);
    expect(screen.queryByRole("button", { name: /^Disband/u })).toBeNull();
    cleanup();
    const { draft, user } = renderLive((session) => <SelectionBar scenario={scenario} session={session} />, [infantry, general]);
    await user.click(screen.getByRole("button", { name: "Disband" }));
    expect(screen.getByRole("group", { name: `Disband ${unitName(scenario, infantry.id)}` })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Disband" }));
    expect(draft().disbands?.map(({ unitId }) => unitId)).toEqual([infantry.id]);
    expect(draft().selectedUnitIds).toEqual([]);
    cleanup();
    renderLive((session) => <SelectionBar scenario={scenario} session={session} />, [general]);
    expect(screen.queryByRole("button", { name: "Disband" })).toBeNull();
  });

  it("is the same menu in the selection bar, which keeps the focus", async () => {
    const { draft, user } = renderLive((session) => <SelectionBar scenario={scenario} session={session} />, [infantry]);
    await user.click(screen.getByRole("button", { name: "Disband" }));
    expect(screen.getByText(/Saves [\d.]+ Funds and [\d.]+k Manpower a turn\.$/u).textContent).toContain(`Disband ${unitName(scenario, infantry.id)}?`);
    await user.click(screen.getByRole("button", { name: "Disband" }));
    expect(draft().disbands).toHaveLength(1);
    expect(draft().selectedUnitIds).toEqual([]);
    expect(document.activeElement?.className).toBe("selection-bar");
  });
});

describe("Disband among an aircraft's missions (N1)", () => {
  it("asks once more, and Keep takes either step back", async () => {
    const plane = unitOf("air");
    const { draft, user } = renderLive((session) => <AircraftDisband scenario={scenario} session={session} unit={plane} />);
    const disband = screen.getByRole("button", { name: "Disband" });
    await user.click(disband);
    await user.click(screen.getByRole("button", { name: "Keep" }));
    expect(document.activeElement).toBe(disband);
    await user.click(disband);
    const confirm = screen.getByRole("group", { name: `Disband ${unitName(scenario, plane.id)}` });
    await user.click(within(confirm).getByRole("button", { name: "Disband" }));
    expect(draft().disbands).toEqual([{ factionId: republic, kind: "disband", unitId: plane.id }]);
    expect(disband.getAttribute("aria-pressed")).toBe("true");
    await user.click(disband);
    expect(screen.getByText("Goes home at the end of the turn.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Keep" }));
    expect(draft().disbands).toEqual([]);
    expect(document.activeElement).toBe(disband);
    cleanup();
    renderLive((session) => <AircraftDisband scenario={scenario} session={session} unit={general} />);
    expect(screen.queryByRole("button", { name: "Disband" })).toBeNull();
  });
});

describe("the shortage warning (D1)", () => {
  it("shows only while next turn's stock falls short", () => {
    const broke: GameState = { ...initial, subTerritories: {}, treasuries: { ...initial.treasuries, [republic]: {} } };
    render(<ShortageWarning scenario={scenario} session={planning(broke)} />);
    expect(screen.getByRole("status").textContent).toMatch(/^Funds will be [\d.]+ short next turn\. Manpower will be [\d.]+k short next turnRecruiting and Replenish are off\./u);
    cleanup();
    render(<ShortageWarning scenario={scenario} session={planning()} />);
    expect(screen.queryByRole("status")).toBeNull();
    cleanup();
    const free: Scenario = { ...withoutUpkeep(scenario) };
    delete (free as { upkeep?: unknown }).upkeep;
    render(<ShortageWarning scenario={free} session={planning(broke)} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("the Upkeep row (D1)", () => {
  it("folds its lines away and back", async () => {
    const ledger = ledgersFor(scenario, initial, republic, {}).find((entry) => entry.resourceId === ("manpower" as ResourceId))!;
    render(<Ledger ledger={ledger} scenario={scenario} />);
    const fold = screen.getByRole("button", { name: "Upkeep" });
    expect(fold.getAttribute("aria-expanded")).toBe("true");
    expect(within(screen.getByRole("table")).getByRole("row", { name: /^Militia column, \d+ at 1\.5k/u })).toBeDefined();
    await userEvent.setup().click(fold);
    expect(screen.queryByRole("row", { name: /^Militia column/u })).toBeNull();
  });
});
