import { battleOutcome, type PendingBattle } from "../battle";
import { gradedOutcome, isGradedBattle } from "../d20/battle";
import { diffCities, diffControl } from "../control";
import type { Settled } from "../retreat";
import type {
  BattleOutcome,
  BounceCause,
  FactionId,
  NoMoveOutcome,
  Retreat,
  TurnOutcome,
  TurnResolutionResult,
  UnitId
} from "../types";
import { draftState, type TurnDraft } from "./draft";

/**
 * The turn's report from its last draft. Every valid move is reported once: as a reinforcement,
 * an unopposed move, a bounce without a battle, or through the battles its army fought in (a
 * meeting winner may fight twice). Outcomes come in this order: moves, battles, impossible and
 * rejected orders, holds, recoveries, then the Milestone 3 events.
 */
export function turnResult(draft: TurnDraft): TurnResolutionResult {
  const { scenario, start, submissions } = draft.input;
  const { orders, settled } = draft;
  const battles: BattleOutcome[] = [
    ...draft.meetings.battles,
    ...[...draft.front.battles, ...draft.standing].map((battle) => withDepartures(battle, settled))
  ];
  const moveOutcomes = new Map<UnitId, TurnOutcome>([
    ...orders.reinforcements.map((order): [UnitId, TurnOutcome] => [order.unitId, { kind: "reinforcement-arrived", order }]),
    ...draft.meetings.bounced.map((outcome): [UnitId, TurnOutcome] => [outcome.order.unitId, outcome]),
    ...draft.front.arrivals.map((outcome): [UnitId, TurnOutcome] => [outcome.order.unitId, outcome]),
    ...settled.flatMap((entry): [UnitId, TurnOutcome][] => {
      const outcome = standoffOutcome(entry);
      return outcome === undefined ? [] : [[entry.leaving.unitId, outcome]];
    })
  ]);
  const { result: victory } = draft.victory;
  return {
    cityChanges: diffCities(scenario, start.cityControl, draft.control.cityControl),
    controlChanges: diffControl(scenario, start.control, draft.control.control),
    finalState: draftState(draft),
    outcomes: [
      ...orders.valid.flatMap((order) => moveOutcomes.get(order.unitId) ?? []),
      ...battles,
      ...orders.invalid,
      ...orders.rejected,
      ...holdOutcomes(draft),
      ...draft.recovered,
      ...draft.events
    ],
    progress: draft.victory.progress,
    subTerritoryChanges: draft.subTerritoryChanges,
    submittedOrders: submissions.flatMap((submission) => submission.orders),
    ...(victory === undefined ? {} : { victory })
  };
}

/** M21: retreats and surrenders are reported in the battle that caused them. */
function withDepartures(pending: PendingBattle, settled: readonly Settled[]): BattleOutcome {
  const mine = settled.filter((entry) => "battleIndex" in entry.leaving.report && entry.leaving.report.battleIndex === pending.battle.index);
  const retreats = mine.flatMap((entry): Retreat[] =>
    entry.kind === "retreated" ? [{ from: entry.leaving.from, to: entry.to, unitId: entry.leaving.unitId }] : []);
  const surrenderedUnitIds = mine.flatMap((entry) => (entry.kind === "surrendered" ? [entry.leaving.unitId] : []));
  const report = { ...pending.report, retreats, surrenderedUnitIds };
  return isGradedBattle(pending.battle) ? gradedOutcome(pending.battle, pending.site, report) : battleOutcome(pending.battle, pending.site, report);
}

/** M19, M21: an entry tie bounces without a battle; the move reports where its army ended. */
function standoffOutcome(entry: Settled): TurnOutcome | undefined {
  const { report } = entry.leaving;
  if (!("order" in report)) {
    return undefined;
  }
  const { order } = report;
  const cause: BounceCause = { kind: "standoff", opposingFactionIds: report.opposingFactionIds };
  switch (entry.kind) {
    case "home":
      return { cause, kind: "bounced-move", order };
    case "retreated":
      return { cause, kind: "bounced-move", order, retreatedTo: entry.to };
    case "surrendered":
      return { capturedByFactionId: requireTaker(entry.takenBy), cause, kind: "disbanded-move", order };
  }
}

function requireTaker(factionId: FactionId | undefined): FactionId {
  if (factionId === undefined) {
    throw new Error("Invariant violated: a returning army surrendered without its origin being taken.");
  }
  return factionId;
}

function holdOutcomes(draft: TurnDraft): readonly NoMoveOutcome[] {
  const { scenario, start, submissions } = draft.input;
  return scenario.factions.flatMap((faction): NoMoveOutcome[] => {
    const submission = submissions.find((candidate) => candidate.factionId === faction.id);
    if (submission !== undefined && submission.orders.length > 0) {
      return [];
    }
    const units = Object.values(start.units).filter((unit) => unit.factionId === faction.id);
    return units.length === 0
      ? [{ factionId: faction.id, kind: "no-move" }]
      : units.map((unit) => ({ factionId: faction.id, kind: "no-move", unitId: unit.id }));
  });
}
