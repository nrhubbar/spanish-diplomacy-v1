import { describe, expect, it, vi } from "vitest";
import type { PlanningContext } from "../main/ai/orders/planner";
import { initialGameState } from "../main/engine/resolution";
import type { FactionId, GameState, SubTerritoryId, TurnOutcome, UnitId, UnitTypeId } from "../main/engine/types";
import { advance, nextTurn, resolve } from "../main/state/coordinator";
import { historyEntry } from "../main/state/history";
import { emptyDraft, type GameRecord, type Session } from "../main/state/session";
import { submitDraft } from "../main/state/submit";
import { visibleSession } from "../main/state/visible";
import { faction, spainWithAir, territory } from "./support";

// A spy on the last planner: it receives the computer player's whole planning context.
const contexts: PlanningContext[] = [];
vi.mock("../main/ai/orders/sack", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../main/ai/orders/sack")>();
  return { ...actual, planSackings: (context: PlanningContext) => { contexts.push(context); return actual.planSackings(context); } };
});

const scenario = spainWithAir();
const republic = faction("republic");
const north = faction("north");
const south = faction("south");
const funds = "funds" as never;

/** Private outcomes of every faction, in Aragon (North's) and faction-wide. */
function privateOutcomes(): readonly TurnOutcome[] {
  return scenario.factions.flatMap((entry): TurnOutcome[] => [
    { cut: {}, cutSubTerritoryIds: [], factionId: entry.id, kind: "income", paid: { [funds]: 3 } },
    { kind: "training-started", order: { factionId: entry.id, kind: "recruit", territoryId: territory("aragon"), unitTypeId: "militia-column" as UnitTypeId }, paid: {}, turnsLeft: 2, unitId: `t_${entry.id}_militia-column_1` as UnitId },
    { kind: "recon", order: { factionId: entry.id, kind: "air-mission", mission: { kind: "recon", territoryId: territory("aragon") }, unitId: `${entry.id}-recon` as UnitId }, territoryId: territory("aragon"), untilTurn: 3 }
  ]);
}

const ownerOf = (outcome: TurnOutcome): FactionId | undefined =>
  "factionId" in outcome ? outcome.factionId : "order" in outcome ? outcome.order.factionId : undefined;

/** A turn-6 board on which every faction holds treasuries, queues and training, and the Republic's recon of Aragon is active. */
function busyState(): GameState {
  const start = initialGameState(scenario);
  const zaragoza = "zaragoza" as SubTerritoryId;
  const girona = "girona" as SubTerritoryId;
  const queued = (factionId: FactionId) => ({ factionId, paid: { [funds]: 2 }, progress: 0, project: { improvement: "rail" as const, kind: "improvement" as const } });
  return {
    ...start,
    reveals: [{ territoryId: territory("aragon"), untilTurn: 6, viewerFactionId: republic }],
    subTerritories: {
      ...start.subTerritories,
      [zaragoza]: { ...start.subTerritories[zaragoza]!, queue: [queued(north)] },
      [girona]: { ...start.subTerritories[girona]!, queue: [queued(republic)] }
    },
    training: scenario.factions.map((entry) => ({ factionId: entry.id, paid: {}, paused: false, territoryId: territory(entry.id === north ? "aragon" : "madrid"), turnsLeft: 1, typeId: "militia-column" as UnitTypeId, unitId: `t_${entry.id}_militia-column_9` as UnitId })),
    treasuries: Object.fromEntries(scenario.factions.map((entry) => [entry.id, { [funds]: 10 }])),
    turnNumber: 6
  };
}

/** History of turn 2, written on a board with no reveals; then the turn-6 board. */
function record(assignments: GameRecord["assignments"]): GameRecord {
  const turnTwo = { ...initialGameState(scenario), turnNumber: 2 };
  return { assignments, history: [historyEntry(scenario, turnTwo, privateOutcomes())], locked: {}, scenarioId: scenario.id, seed: 5, state: busyState() };
}

describe("a computer player's memory (CT-37, CT-38, M1)", () => {
  it("plans on its own treasury, queues and training, and remembers only what it saw on each turn", () => {
    contexts.length = 0;
    const assignments = Object.fromEntries(scenario.factions.map((entry) => [entry.id, "computer" as const]));
    advance(scenario, record(assignments));
    expect(contexts.map((context) => context.factionId)).toEqual(scenario.factions.map((entry) => entry.id));
    for (const context of contexts) {
      const { factionId, memory, state } = context;
      const revealedHolders = factionId === republic ? [north] : [];
      expect(Object.keys(state.treasuries).sort(), factionId).toEqual([factionId, ...revealedHolders].sort());
      expect(state.training.every((item) => item.factionId === factionId || item.territoryId === territory("aragon"))).toBe(true);
      expect(Object.values(state.subTerritories).flatMap((site) => site.queue).every((item) => item.factionId === factionId || (factionId === republic && item.factionId === north))).toBe(true);
      expect(state.reveals.every((reveal) => reveal.viewerFactionId === factionId)).toBe(true);
      // Turn 2 is remembered as it was seen then: the Republic's reveal now opens none of it.
      for (const turn of [...(memory.history ?? []), memory.previousOutcomes ?? []]) {
        expect(turn.filter((outcome) => outcome.kind !== "weather-rolled").map(ownerOf).every((owner) => owner === factionId), factionId).toBe(true);
        expect(turn).toHaveLength(3);
      }
      expect(memory.previousOutcomes).toEqual(memory.history?.at(-1));
    }
  });

  it("gives a planning player's visible session the same history, holding no other viewer's view", () => {
    const assignments = Object.fromEntries(scenario.factions.map((entry) => [entry.id, entry.id === republic ? "local-human" as const : "computer" as const]));
    const game = record(assignments);
    const seen = visibleSession(scenario, { draft: { orders: [], selectedUnitIds: [] }, factionId: republic, game, phase: "planning" });
    const [entry] = seen.game.history;
    expect(entry?.outcomes.map(ownerOf)).toEqual([republic, republic, republic]);
    expect(Object.keys(entry?.seen.byFaction ?? {})).toEqual([republic]);
    expect(entry?.seen.shared).toEqual([]);
    // With the reveal written on turn 2's own board, turn 2 shows North's Aragon training and income, never its recon.
    const scouted = historyEntry(scenario, { ...initialGameState(scenario), reveals: [{ territoryId: territory("aragon"), untilTurn: 3, viewerFactionId: republic }], turnNumber: 2 }, privateOutcomes());
    expect(scouted.seen.byFaction[republic]?.filter((outcome) => ownerOf(outcome) === north).map((outcome) => outcome.kind)).toEqual(["income", "training-started"]);
    expect(scouted.seen.byFaction[south]?.every((outcome) => ownerOf(outcome) === south)).toBe(true);
  });
});

describe("history written by nextTurn (M1, D7)", () => {
  it("opens a recon's reveal for its own turn only", () => {
    const assignments = Object.fromEntries(scenario.factions.map((entry) => [entry.id, entry.id === republic ? "local-human" as const : "computer" as const]));
    const recon = { factionId: republic, kind: "air-mission" as const, mission: { kind: "recon" as const, territoryId: territory("aragon") }, unitId: "rep-catalan-recon" as UnitId };
    const start: GameRecord = { assignments, history: [], locked: Object.fromEntries(scenario.factions.map((entry) => [entry.id, { factionId: entry.id, orders: entry.id === republic ? [recon] : [] }])), scenarioId: scenario.id, seed: 5, state: initialGameState(scenario) };
    const northIncome = (outcomes: readonly TurnOutcome[] | undefined) => (outcomes ?? []).some((outcome) => outcome.kind === "income" && outcome.factionId === north);
    const turnOne = resolve(scenario, start);
    if (turnOne.phase !== "resolution") throw new Error("Turn 1 did not resolve.");
    const planning: Session = nextTurn(scenario, turnOne.game, turnOne.result.outcomes);
    if (planning.phase !== "planning") throw new Error("Not planning turn 2.");
    expect(northIncome(planning.game.history[0]?.seen.byFaction[republic])).toBe(true);
    expect(northIncome(planning.game.history[0]?.seen.byFaction[south])).toBe(false);
    const turnTwo = submitDraft(scenario, { ...planning, draft: emptyDraft });
    if (turnTwo.phase !== "resolution") throw new Error("Turn 2 did not resolve.");
    const after = nextTurn(scenario, turnTwo.game, turnTwo.result.outcomes);
    if (after.phase !== "planning") throw new Error("Not planning turn 3.");
    expect(after.game.history.map((entry) => entry.turnNumber)).toEqual([1, 2]);
    expect(northIncome(after.game.history[1]?.seen.byFaction[republic])).toBe(false);
    expect(northIncome(after.game.history[0]?.seen.byFaction[republic])).toBe(true);
  });
});
