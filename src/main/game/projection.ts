import type { ActorKind, FactionId, Scenario } from "../engine/types";
import { ordersFor, outcomesFor, viewFor } from "../engine/visibility";
import { playersOf } from "./clock";
import { outcomesSeen } from "./service";
import type { GameRecord, PlayerId, PlayerView, TurnReport } from "./types";

/** The factions a player holds, in scenario order. */
export function seatsOf(scenario: Scenario, record: Pick<GameRecord, "seats">, playerId: PlayerId): readonly FactionId[] {
  return scenario.factions.map((faction) => faction.id).filter((id) => {
    const seat = record.seats[id];
    return seat?.kind === "human" && seat.playerId === playerId;
  });
}

/**
 * $6, U4: everything one player is sent, built field by field from the record: nothing of it is
 * spread, so what is private stays private until it is named here. A player with one seat sees as
 * that faction; one with several (people sharing a device) sees as the seat opened, or, between
 * turns, only what is public.
 */
export function playerView(scenario: Scenario, record: GameRecord, playerId: PlayerId, opened?: FactionId): PlayerView {
  const seats = seatsOf(scenario, record, playerId);
  const viewer = seats.length === 1 ? seats[0] : seats.find((id) => id === opened);
  const reporter = seats.length === 1 ? viewer : undefined;
  const clock = viewer === undefined ? undefined : record.clocks[viewer];
  const saved = viewer === undefined ? undefined : record.orders[viewer];
  return {
    assignments: Object.fromEntries(scenario.factions.map((faction): [FactionId, ActorKind] => [faction.id, actorKind(record, faction.id, playerId)])),
    gameId: record.gameId,
    // Each turn as the viewer saw it then (M1): a reveal now never opens an earlier turn.
    history: record.turns.map((turn) => ({ outcomes: outcomesSeen(turn, viewer), turnNumber: turn.turnNumber })),
    pausable: playersOf(record.seats).length === 1,
    ready: scenario.factions.map((faction) => faction.id).filter((id) => record.status === "ended" || record.orders[id]?.ended === true),
    scenarioId: record.scenarioId,
    seats,
    seedChosen: record.seedChosen,
    state: viewFor(scenario, record.state, viewer),
    status: record.status,
    timerMinutes: record.timerMinutes,
    version: record.version,
    ...(clock === undefined ? {} : { clock }),
    ...(record.report === undefined ? {} : { report: reportFor(scenario, record.report, reporter) }),
    ...(saved === undefined ? {} : { saved }),
    ...(record.status === "ended" ? { seed: record.seed } : {}),
    ...(viewer === undefined ? {} : { viewer })
  };
}

function actorKind(record: GameRecord, factionId: FactionId, playerId: PlayerId): ActorKind {
  const seat = record.seats[factionId];
  return seat?.kind !== "human" ? "computer" : seat.playerId === playerId ? "local-human" : "online-human";
}

/** The turn's report as one viewer may read it. Who controls what is public; orders and outcomes are filtered. */
function reportFor(scenario: Scenario, report: TurnReport, viewer: FactionId | undefined): TurnReport {
  return {
    cityChanges: report.cityChanges,
    controlChanges: report.controlChanges,
    finalState: viewFor(scenario, report.finalState, viewer),
    outcomes: outcomesFor(scenario, report.finalState, report.outcomes, viewer),
    progress: report.progress,
    subTerritoryChanges: report.subTerritoryChanges,
    submittedOrders: ordersFor(scenario, report.finalState, report.submittedOrders, viewer),
    turnNumber: report.turnNumber,
    ...(report.victory === undefined ? {} : { victory: report.victory })
  };
}
