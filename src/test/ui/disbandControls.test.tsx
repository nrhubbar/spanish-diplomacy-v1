import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it } from "vitest";
import { Ledger } from "../../main/components/header/Ledger";
import { initialGameState } from "../../main/engine/resolution";
import type { GameState, ResourceId, Scenario, UnitState, UnitTypeId } from "../../main/engine/types";
import { RegistryContext } from "../../main/hooks";
import { useSession } from "../../main/hooks";
import { ledgersFor } from "../../main/presentation/ledger";
import { unitName } from "../../main/presentation/text";
import { DisbandControls } from "../../main/screens/pane/DisbandControls";
import { ShortageWarning } from "../../main/screens/pane/ShortageWarning";
import type { PlanningSession } from "../../main/state/planning";
import { emptyDraft } from "../../main/state/session";
import { faction, shippedRegistry, spainId, spainWithAir, testStore, withoutUpkeep } from "../support";

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

function Live({ unit }: { readonly unit: UnitState }) {
  const session = useSession();
  return session.phase === "planning" ? <DisbandControls scenario={scenario} session={session} unit={unit} /> : null;
}

function renderControls(unit: UnitState) {
  const store = testStore({ game: { session: planning() } });
  render(<Provider store={store}><RegistryContext value={shippedRegistry()}><Live unit={unit} /></RegistryContext></Provider>);
  const disbands = () => { const { session } = store.getState().game; return session.phase === "planning" ? session.draft.disbands ?? [] : []; };
  return { disbands, user: userEvent.setup() };
}

describe("Disband on a unit's card (D1)", () => {
  const name = unitName(scenario, infantry.id);

  it("asks once more before it plans the order, and Keep takes either step back", async () => {
    const { disbands, user } = renderControls(infantry);
    expect(screen.getByText(/^Saves .* a turn$/u)).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Disband" }));
    expect(screen.getByText(/^Disband this unit\? Saves .* a turn\.$/u)).toBeDefined();
    expect(disbands()).toEqual([]);
    expect(screen.getByRole("group", { name: `Disband ${name}` })).toBeDefined();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep" }));
    await user.click(screen.getByRole("button", { name: "Keep" }));
    await user.click(screen.getByRole("button", { name: "Disband" }));
    await user.click(screen.getByRole("button", { name: "Disband" }));
    expect(disbands()).toEqual([{ factionId: republic, kind: "disband", unitId: infantry.id }]);
    expect(screen.getByText("Goes home at the end of the turn.")).toBeDefined();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep" }));
    await user.click(screen.getByRole("button", { name: "Keep" }));
    expect(disbands()).toEqual([]);
    expect(screen.getByRole("button", { name: "Disband" })).toBeDefined();
  });

  it("is on aircraft's panes and not on generals' cards", () => {
    renderControls(unitOf("air"));
    expect(screen.getByRole("button", { name: /^Disband/u })).toBeDefined();
    cleanup();
    renderControls(Object.values(initial.units).find((unit) => kindOf(unit) === "general")!);
    expect(screen.queryByRole("button", { name: /^Disband/u })).toBeNull();
  });
});

describe("the shortage warning (D1)", () => {
  it("shows only while next turn's stock falls short", () => {
    const broke: GameState = { ...initial, subTerritories: {}, treasuries: { ...initial.treasuries, [republic]: {} } };
    render(<ShortageWarning scenario={scenario} session={planning(broke)} />);
    expect(screen.getByRole("status").textContent).toMatch(/^Manpower will be [\d.]+k short next turnRecruiting and Replenish are off\./u);
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
