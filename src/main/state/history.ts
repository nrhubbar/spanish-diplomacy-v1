import type { FactionId, GameState, Scenario, TurnOutcome } from "../engine/types";
import { outcomesFor } from "../engine/visibility";
import type { TurnHistoryEntry } from "./session";

/**
 * $6, U4 (CT-37, CT-38): a turn's history entry, filtered once for every faction and for a
 * shared screen when the turn is written, against that turn's own final board and reveals.
 * A later reveal never opens an earlier turn, and a reveal lasts its one turn (D7).
 */
export function historyEntry(scenario: Scenario, finalState: GameState, outcomes: readonly TurnOutcome[]): TurnHistoryEntry {
  const byFaction = Object.fromEntries(scenario.factions.map((faction) => [faction.id, outcomesFor(scenario, finalState, outcomes, faction.id)]));
  return { outcomes, seen: { byFaction, shared: outcomesFor(scenario, finalState, outcomes, undefined) }, turnNumber: finalState.turnNumber };
}

/** What a viewer saw of a turn: its faction's view, or the shared one with no viewer (or an unknown one). */
export function seenBy(entry: TurnHistoryEntry, viewer: FactionId | undefined): readonly TurnOutcome[] {
  return (viewer === undefined ? undefined : entry.seen.byFaction[viewer]) ?? entry.seen.shared;
}

/** A history entry as one viewer may hold it: only that viewer's view is kept. */
export function entryFor(entry: TurnHistoryEntry, viewer: FactionId | undefined): TurnHistoryEntry {
  const outcomes = seenBy(entry, viewer);
  return { outcomes, seen: { byFaction: viewer === undefined ? {} : { [viewer]: outcomes }, shared: entry.seen.shared }, turnNumber: entry.turnNumber };
}
