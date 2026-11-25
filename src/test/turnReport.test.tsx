import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { raisedUnitId } from "../main/engine/recruitment/rules";
import { initialGameState } from "../main/engine/resolution";
import type {
  BuildingId,
  BuildProject,
  MilestoneTwoOutcome,
  ResourceId,
  Resources,
  SubTerritoryId,
  SystemOutcome,
  TurnOutcome,
  TurnResolutionResult,
  UnitTypeId
} from "../main/engine/types";
import { systemOutcomeKinds } from "../main/presentation/systemText";
import { FocusNote, OutcomeSummary } from "../main/screens/ResultPanels";
import { eventsAt, systemOutcomePlaces } from "../main/screens/report/focus";
import { groupOpen, outcomeGroups, sectionKinds } from "../main/screens/report/groups";
import { spentBy } from "../main/presentation/treasury";
import { Treasury } from "../main/screens/report/Treasury";
import { faction, spainWithAir, territory, tiny, unit } from "./support";

afterEach(cleanup);

const scenario = spainWithAir();
const state = initialGameState(scenario);
const republic = faction("republic");
const south = faction("south");
const sub = (id: string): SubTerritoryId => id as SubTerritoryId;
const amount = (funds: number, manpower = 0): Resources => ({ ["funds" as ResourceId]: funds, ["manpower" as ResourceId]: manpower });
const hospital: BuildProject = { buildingId: "hospital" as BuildingId, kind: "building" };
const militia = raisedUnitId(republic, "militia-column" as UnitTypeId, 3);
const covadonga = unit("rep-covadonga-4");

function result(outcomes: readonly TurnOutcome[]): TurnResolutionResult {
  return { cityChanges: [], controlChanges: [], finalState: state, outcomes, progress: [], subTerritoryChanges: [], submittedOrders: [] };
}

const milestoneTwoKinds: readonly MilestoneTwoOutcome["kind"][] = [
  "successful-move", "bounced-move", "disbanded-move", "invalid-order", "rejected-order", "no-move", "reinforcement-arrived", "recovered", "battle"
];

const transit: SystemOutcome = { factionId: republic, from: territory("madrid"), kind: "move-transit", legs: [{ kind: "rail", to: territory("valencia") }], to: territory("valencia"), unitIds: [covadonga] };
const intercepted: SystemOutcome = { byFactionIds: [south], factionId: republic, from: territory("madrid"), kind: "move-intercepted", stoppedAt: territory("castilla-la-mancha"), to: territory("andalucia"), unitIds: [covadonga] };
const surrendered: SystemOutcome = { factionId: republic, from: territory("andalucia"), kind: "path-surrender", men: 500, unitId: covadonga };
const tired: SystemOutcome = { demoralized: false, factionId: republic, fatigue: 1, kind: "fatigue", unitId: covadonga };
const exhausted: SystemOutcome = { ...tired, demoralized: true, fatigue: 3 };
const queued: SystemOutcome = { kind: "build-queued", order: { factionId: republic, kind: "build", project: hospital, subTerritoryId: sub("girona") }, paid: amount(10), position: 0 };
const completed: SystemOutcome = { factionId: republic, kind: "build-completed", project: hospital, subTerritoryId: sub("girona") };
const started: SystemOutcome = { kind: "training-started", order: { factionId: republic, kind: "recruit", territoryId: territory("catalunya"), unitTypeId: "militia-column" as UnitTypeId }, paid: amount(2, 3), turnsLeft: 1, unitId: militia };
const paused: SystemOutcome = { factionId: republic, kind: "training-paused", territoryId: territory("catalunya"), unitId: militia };
const income: SystemOutcome = { cut: amount(1), cutSubTerritoryIds: [sub("barcelona")], factionId: republic, kind: "income", paid: amount(14, 27) };
const rail: SystemOutcome = { after: 1, before: 2, kind: "rail-damaged", subTerritoryId: sub("girona") };

describe("the turn report's groups (D25, M10)", () => {
  it("shows every outcome kind in exactly one group or in a section of its own", () => {
    const grouped = outcomeGroups.flatMap((group) => group.kinds);
    for (const kind of [...milestoneTwoKinds, ...systemOutcomeKinds]) {
      const homes = grouped.filter((entry) => entry === kind).length + sectionKinds.filter((entry) => entry === kind).length;
      expect(homes, kind).toBe(1);
    }
  });

  it("lists the new groups with icons and counts, opening the serious ones and closing routine ones", () => {
    const { container } = render(<OutcomeSummary result={result([transit, intercepted, surrendered, tired, queued, started, rail])} scenario={scenario} viewer={republic} />);
    const summaries = [...container.querySelectorAll("details.outcome-group")].map((details) => [details.querySelector("summary")?.textContent.trim(), (details as HTMLDetailsElement).open]);
    expect(summaries).toEqual([
      ["Cut off (1)", true],
      ["Stopped on the way (1)", true],
      ["By rail and sea (1)", false],
      ["Fatigue (1)", false],
      ["Recruitment (1)", false],
      ["Building (1)", false],
      ["Rail damage (1)", false]
    ]);
    // X8: line icons for the Milestone 3 groups, medallions for the ones with art.
    expect(container.querySelectorAll(".outcome-line-icon svg").length).toBe(4);
    expect(screen.getByText(/stopped in Castilla-La Mancha on the way to Andaluc\u00eda/u)).toBeInTheDocument();
  });

  it("opens a routine group when something in it went wrong, and orders its lines", () => {
    const fatigue = outcomeGroups.find((group) => group.label === "Fatigue")!;
    expect(groupOpen(fatigue, [tired])).toBe(false);
    expect(groupOpen(fatigue, [tired, exhausted])).toBe(true);
    const recruitment = outcomeGroups.find((group) => group.label === "Recruitment")!;
    expect(groupOpen(recruitment, [started, paused])).toBe(true);
    const building = outcomeGroups.find((group) => group.label === "Building")!;
    expect(groupOpen(building, [queued])).toBe(false);
    expect(groupOpen(building, [queued, completed])).toBe(true);

    render(<OutcomeSummary result={result([queued, completed])} scenario={scenario} viewer={republic} />);
    const lines = within(screen.getByText("Building (2)").closest("details")!).getAllByRole("listitem").map((item) => item.textContent);
    expect(lines[0]).toMatch(/built a Hospital at Girona/u);
    expect(lines[1]).toMatch(/paid 10 Funds for Hospital/u);
  });

  it("sums routine build progress into one line once there are three", () => {
    const progress = (id: string, done: number): SystemOutcome => ({ factionId: republic, kind: "build-progressed", progress: done, project: hospital, subTerritoryId: sub(id), turns: 4 });
    render(<OutcomeSummary result={result([completed, progress("girona", 1), progress("lleida", 2), progress("tarragona", 3)])} scenario={scenario} viewer={republic} />);
    const lines = within(screen.getByText("Building (4)").closest("details")!).getAllByRole("listitem").map((item) => item.textContent);
    expect(lines).toEqual([
      "Republican Government built a Hospital at Girona.",
      "3 builds progressed: Hospital at Girona, 1 of 4 turns done; Hospital at Lleida, 2 of 4 turns done; Hospital at Tarragona, 3 of 4 turns done."
    ]);
  });
});

describe("the Treasury (D25)", () => {
  it("gives the viewer's income and what this turn's orders spent", () => {
    render(<Treasury result={result([income, queued, started])} scenario={scenario} viewer={republic} />);
    const section = screen.getByRole("region", { name: "Treasury" });
    expect(section).toHaveTextContent(/income from territories held whole: \+14 Funds/u);
    expect(section).toHaveTextContent("Spent this turn: 12 Funds and 3k Manpower.");
  });

  it("is private and quiet: nothing without a viewer, for another faction's outcomes, or without an economy", () => {
    const { container } = render(
      <>
        <Treasury result={result([income])} scenario={scenario} viewer={undefined} />
        <Treasury result={result([income, queued])} scenario={scenario} viewer={south} />
        <Treasury result={result([])} scenario={tiny()} viewer={republic} />
      </>
    );
    expect(container).toBeEmptyDOMElement();
    expect(spentBy([queued, started, { kind: "replenish-applied", men: 700, order: { factionId: republic, kind: "replenish", unitId: militia }, paid: amount(1, 1), recovered: false }], republic)).toEqual(amount(13, 4));
  });

  it("shows spending alone when no income was paid", () => {
    render(<Treasury result={result([queued])} scenario={scenario} viewer={republic} />);
    expect(screen.getByRole("region", { name: "Treasury" })).toHaveTextContent(/^TreasurySpent this turn: 10 Funds\.$/u);
  });
});

describe("focus notes for Milestone 3 outcomes (D25, F1)", () => {
  it("maps each kind to the territories it happened in", () => {
    expect(systemOutcomePlaces(scenario, state, transit)).toEqual(["madrid", "valencia"]);
    expect(systemOutcomePlaces(scenario, state, intercepted)).toEqual(["madrid", "andalucia", "castilla-la-mancha"]);
    expect(systemOutcomePlaces(scenario, state, surrendered)).toEqual(["andalucia"]);
    expect(systemOutcomePlaces(scenario, state, { kind: "withdrew", order: { factionId: republic, from: territory("andalucia"), kind: "withdraw", to: territory("murcia"), unitId: covadonga } })).toEqual(["andalucia", "murcia"]);
    expect(systemOutcomePlaces(scenario, state, { factionId: republic, from: territory("madrid"), kind: "move-held-back", reason: "allowance", to: territory("galicia"), unitIds: [covadonga] })).toEqual(["madrid", "galicia"]);
    expect(systemOutcomePlaces(scenario, state, started)).toEqual(["catalunya"]);
    expect(systemOutcomePlaces(scenario, state, paused)).toEqual(["catalunya"]);
    expect(systemOutcomePlaces(scenario, state, queued)).toEqual(["catalunya"]);
    expect(systemOutcomePlaces(scenario, state, completed)).toEqual(["catalunya"]);
    expect(systemOutcomePlaces(scenario, state, rail)).toEqual(["catalunya"]);
    const home = state.units[covadonga]!.territoryId;
    expect(systemOutcomePlaces(scenario, state, tired)).toEqual([home]);
    expect(systemOutcomePlaces(scenario, state, { kind: "replenish-cancelled", order: { factionId: republic, kind: "replenish", unitId: covadonga }, refusal: { code: "unit-fought" }, refund: {} })).toEqual([home]);
    expect(systemOutcomePlaces(scenario, state, { kind: "replenish-applied", men: 1, order: { factionId: republic, kind: "replenish", unitId: militia }, paid: {}, recovered: false })).toEqual([]);
    expect(systemOutcomePlaces(scenario, state, { factionId: republic, kind: "fatigue", demoralized: false, fatigue: 1, unitId: militia })).toEqual([]);
    expect(systemOutcomePlaces(scenario, state, income)).toEqual([]);
    expect(systemOutcomePlaces(scenario, state, { ...completed, subTerritoryId: sub("nowhere") })).toEqual([]);
  });

  it("lists a place's events most serious first, in the viewer's words", () => {
    const events = eventsAt(scenario, result([queued, transit, intercepted, started]), territory("madrid"), { state, viewer: republic });
    expect(events).toHaveLength(2);
    expect(events[0]).toMatch(/stopped in Castilla-La Mancha/u);
    expect(events[1]).toMatch(/travelled Madrid/u);
    // Training comes before builds; within builds, the finished one before the queued one.
    expect(eventsAt(scenario, result([queued, completed, started]), territory("catalunya"))).toEqual([
      expect.stringMatching(/began training/u),
      expect.stringMatching(/built a Hospital/u),
      expect.stringMatching(/paid 10 Funds/u)
    ]);
  });

  it("renders the note with the viewer's lines", () => {
    render(<FocusNote battle={false} focusedTerritoryId={territory("catalunya")} result={result([paused])} scenario={scenario} viewer={republic} />);
    expect(screen.getByRole("region", { name: /What happened in Catalu\u00f1a/u })).toHaveTextContent(/contested/u);
  });
});
