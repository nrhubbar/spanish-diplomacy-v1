import { describe, expect, it, vi } from "vitest";
import type { PlanningContext } from "../main/ai/orders/planner";
import { initialGameState } from "../main/engine/resolution";
import type { FactionId, GameState, SubTerritoryId, TurnOutcome, TurnResolutionResult, UnitId, UnitTypeId } from "../main/engine/types";
import { playerView } from "../main/game/projection";
import { createGame, outcomesSeen, turnRecord } from "../main/game/service";
import type { GameRecord, Seat } from "../main/game/types";
import { commanded, endedWith, faction, spainWithAir, territory, testGame, testPlayer } from "./support";

// A spy on the last planner: it receives the computer player's whole planning context.
const contexts: PlanningContext[] = [];
vi.mock("../main/ai/orders/sack", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../main/ai/orders/sack")>();
  return { ...actual, planSackings: (context: PlanningContext) => { contexts.push(context); return actual.planSackings(context); } };
});

// A turn that ends on a board the test made, so the next one is planned on it.
const staged = vi.hoisted((): { result?: unknown } => ({}));
vi.mock("../main/engine/resolution", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../main/engine/resolution")>();
  return { ...actual, resolveTurn: (...args: Parameters<typeof actual.resolveTurn>) => (staged.result as TurnResolutionResult | undefined) ?? actual.resolveTurn(...args) };
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

const human: Seat = { kind: "human", playerId: testPlayer };
const computer: Seat = { kind: "computer" };

function game(seatOf: (factionId: FactionId) => Seat): GameRecord {
  const seats = Object.fromEntries(scenario.factions.map((entry): [FactionId, Seat] => [entry.id, seatOf(entry.id)]));
  return createGame(scenario, { gameId: testGame, rollScheme: "numeric-1", scenarioVersion: "test", seats, seed: "5", seedChosen: true, timerMinutes: 0 }, 0);
}

/** Turn 2, written on a board with no reveals. */
const turnTwo = () => turnRecord(scenario, { ...initialGameState(scenario), turnNumber: 2 }, privateOutcomes());

describe("a computer player's memory (CT-37, CT-38, M1)", () => {
  it("plans on its own treasury, queues and training, and remembers only what it saw on each turn", () => {
    const start = game(() => computer);
    const before: GameRecord = { ...start, state: { ...start.state, turnNumber: 5 }, turns: [turnTwo()] };
    // Turn 5 ends on the busy board, under the Republic's reveal, with private outcomes of its own.
    staged.result = { cityChanges: [], controlChanges: [], finalState: { ...busyState(), turnNumber: 5 }, outcomes: privateOutcomes(), progress: [], subTerritoryChanges: [], submittedOrders: [] } satisfies TurnResolutionResult;
    contexts.length = 0;
    try {
      commanded(scenario, before, { kind: "advance", turnNumber: 5 });
    } finally {
      delete staged.result;
    }
    expect(contexts.map((context) => context.factionId)).toEqual(scenario.factions.map((entry) => entry.id));
    for (const context of contexts) {
      const { factionId, memory, state } = context;
      expect(state.turnNumber).toBe(6);
      const revealedHolders = factionId === republic ? [north] : [];
      expect(Object.keys(state.treasuries).sort(), factionId).toEqual([factionId, ...revealedHolders].sort());
      expect(state.training.every((item) => item.factionId === factionId || item.territoryId === territory("aragon"))).toBe(true);
      expect(Object.values(state.subTerritories).flatMap((site) => site.queue).every((item) => item.factionId === factionId || (factionId === republic && item.factionId === north))).toBe(true);
      expect(state.reveals.every((reveal) => reveal.viewerFactionId === factionId)).toBe(true);
      expect(memory.history).toHaveLength(2);
      const [second, fifth] = memory.history ?? [];
      // Turn 2 is remembered as it was seen then: the Republic's reveal now opens none of it.
      expect(second?.map(ownerOf), factionId).toEqual([factionId, factionId, factionId]);
      // Turn 5 ended under the reveal, so the Republic also saw the others' training in Aragon and its holder's income, never their recon.
      expect(fifth?.filter((outcome) => ownerOf(outcome) === factionId)).toHaveLength(3);
      expect(fifth?.filter((outcome) => ownerOf(outcome) !== factionId).map((outcome) => [ownerOf(outcome), outcome.kind]), factionId)
        .toEqual(factionId === republic ? [[north, "income"], [north, "training-started"], [south, "training-started"]] : []);
      expect(memory.previousOutcomes).toEqual(memory.history?.at(-1));
    }
  });

  it("gives a planning player's view the same history, holding no other viewer's view", () => {
    const start = game((id) => (id === republic ? human : computer));
    const view = playerView(scenario, { ...start, state: busyState(), turns: [turnTwo()] }, testPlayer);
    expect(view.viewer).toBe(republic);
    expect(view.history).toHaveLength(1);
    const [entry] = view.history;
    expect(entry?.outcomes.map(ownerOf)).toEqual([republic, republic, republic]);
    // Nothing else of the turn is there: not who saw what, nor what a shared screen saw (nothing).
    expect(Object.keys(entry ?? {}).sort()).toEqual(["outcomes", "turnNumber"]);
    for (const key of ["orders", "seats", "turns", "seed"]) expect((view as unknown as Record<string, unknown>)[key]).toEqual(key === "seats" ? [republic] : undefined);
    expect(outcomesSeen(turnTwo(), undefined)).toEqual([]);
    // With the reveal written on turn 2's own board, turn 2 shows North's Aragon training and income, never its recon.
    const scouted = turnRecord(scenario, { ...initialGameState(scenario), reveals: [{ territoryId: territory("aragon"), untilTurn: 3, viewerFactionId: republic }], turnNumber: 2 }, privateOutcomes());
    expect(outcomesSeen(scouted, republic).filter((outcome) => ownerOf(outcome) === north).map((outcome) => outcome.kind)).toEqual(["income", "training-started"]);
    expect(outcomesSeen(scouted, south).every((outcome) => ownerOf(outcome) === south)).toBe(true);
  });
});

describe("history written as turns resolve (M1, D7)", () => {
  it("opens a recon's reveal for its own turn only", () => {
    // Every seat is held by hand, so nothing but the recon is ordered and no fighter meets it.
    const recon = { factionId: republic, kind: "air-mission" as const, mission: { kind: "recon" as const, territoryId: territory("aragon") }, unitId: "rep-catalan-recon" as UnitId };
    const northIncome = (record: GameRecord, turn: number, viewer: FactionId) => {
      const written = record.turns[turn];
      if (written === undefined) throw new Error(`Turn ${String(turn + 1)} was not written.`);
      return outcomesSeen(written, viewer).some((outcome) => outcome.kind === "income" && outcome.factionId === north);
    };
    const turn = (record: GameRecord, orders: readonly (typeof recon)[]) =>
      scenario.factions.reduce((current, entry) => endedWith(scenario, current, entry.id, entry.id === republic ? orders : []), record);
    const second = turn(game(() => human), [recon]);
    expect(second.state.turnNumber).toBe(2);
    expect(northIncome(second, 0, republic)).toBe(true);
    expect(northIncome(second, 0, south)).toBe(false);
    const third = turn(second, []);
    expect(third.turns.map((entry) => entry.turnNumber)).toEqual([1, 2]);
    expect(third.state.turnNumber).toBe(3);
    expect(northIncome(third, 1, republic)).toBe(false);
    expect(northIncome(third, 0, republic)).toBe(true);
    // And so it reaches each player: the Republic's seat and no other.
    const reached = (viewer: FactionId) => playerView(scenario, third, testPlayer, viewer).history.map((entry) => entry.outcomes.some((outcome) => outcome.kind === "income" && outcome.factionId === north));
    expect(reached(republic)).toEqual([true, false]);
    expect(reached(south)).toEqual([false, false]);
  });
});
