import { generateComputerSubmission } from "../ai/computerPlayer";
import { rollStream } from "../engine/dice";
import { deriveSeed, seededRandom } from "../engine/random";
import { resolveTurn } from "../engine/resolution";
import type { FactionId, PlayerSubmission, Scenario } from "../engine/types";
import { validateSubmission } from "../engine/validation";
import { beforePlanning } from "../engine/weather";
import { historyEntry, seenBy } from "./history";
import { emptyDraft, type GameRecord, localPlayerCount, type Session } from "./session";

/**
 * Submission coordinator (M2 section 7.3). Pure: given a game record whose submissions are
 * partly locked, returns the next session. Computer players submit through the same
 * validation gateway as people. Bounded by the number of factions; never loops unboundedly.
 */
export function advance(scenario: Scenario, game: GameRecord, fromFactionId?: FactionId): Session {
  // Step 0 (T2, T3): the turn's weather is in the state before anyone plans. Idempotent.
  let current = { ...game, state: beforePlanning(scenario, game.state, game.seed) };
  for (const [index, faction] of scenario.factions.entries()) {
    if (current.locked[faction.id] !== undefined) {
      continue;
    }
    const kind = current.assignments[faction.id];
    if (kind === "local-human") {
      return localPlayerCount(current.assignments) > 1
        ? { factionId: faction.id, game: current, phase: "handoff", ...(fromFactionId === undefined ? {} : { fromFactionId }) }
        : { draft: emptyDraft, factionId: faction.id, game: current, phase: "planning" };
    }
    if (kind !== "computer") {
      throw new Error(`Faction "${faction.id}" has no supported actor (${String(kind)}).`);
    }
    const random = seededRandom(deriveSeed(current.seed, current.state.turnNumber, index));
    // $6, U4: a computer player remembers only the outcomes its faction saw on each turn.
    const seen = current.history.map((entry) => seenBy(entry, faction.id));
    const previousOutcomes = seen.at(-1);
    const submission = generateComputerSubmission(scenario, current.state, faction.id, random, {
      blunder: rollStream(current.seed, "blunder", current.state.turnNumber, index),
      history: seen,
      ...(previousOutcomes === undefined ? {} : { previousOutcomes })
    });
    current = lockSubmission(scenario, current, submission);
  }

  // Every faction is locked: the turn resolves at once (T1).
  return resolve(scenario, current);
}

export function lockSubmission(scenario: Scenario, game: GameRecord, submission: PlayerSubmission): GameRecord {
  const validation = validateSubmission(scenario, game.state, submission.factionId, submission);
  if (!validation.ok) {
    throw new Error(`Rejected submission for "${submission.factionId}": ${validation.reason}`);
  }
  return { ...game, locked: { ...game.locked, [submission.factionId]: submission } };
}

export function resolve(scenario: Scenario, game: GameRecord): Session {
  const submissions = scenario.factions.flatMap((faction) => {
    const submission = game.locked[faction.id];
    return submission === undefined ? [] : [submission];
  });
  const result = resolveTurn(scenario, game.state, submissions, game.seed);
  const next: GameRecord = { ...game, state: result.finalState };
  return result.victory === undefined
    ? { game: next, phase: "resolution", result }
    : { game: next, phase: "game-over", result };
}

/** Records the resolved turn (its board is `game.state`) and starts the next one. */
export function nextTurn(scenario: Scenario, game: GameRecord, outcomes: GameRecord["history"][number]["outcomes"]): Session {
  return advance(scenario, {
    ...game,
    history: [...game.history, historyEntry(scenario, game.state, outcomes)],
    locked: {},
    state: { ...game.state, turnNumber: game.state.turnNumber + 1 }
  });
}
