import { generateComputerSubmission } from "../ai/computerPlayer";
import { deriveSeed, seededRandom } from "../engine/random";
import { resolveTurn } from "../engine/resolution";
import type { FactionId, PlayerSubmission, Scenario } from "../engine/types";
import { validateSubmission } from "../engine/validation";
import { emptyDraft, type GameRecord, localPlayerCount, type Session } from "./session";

/**
 * Submission coordinator (M2 section 7.3). Pure: given a game record whose submissions are
 * partly locked, returns the next session. Computer players submit through the same
 * validation gateway as people. Bounded by the number of factions; never loops unboundedly.
 */
export function advance(scenario: Scenario, game: GameRecord, fromFactionId?: FactionId): Session {
  let current = game;
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
    const previousOutcomes = current.history.at(-1)?.outcomes;
    const submission = generateComputerSubmission(scenario, current.state, faction.id, random, {
      history: current.history.map((entry) => entry.outcomes),
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

export function nextTurn(scenario: Scenario, game: GameRecord, outcomes: GameRecord["history"][number]["outcomes"]): Session {
  return advance(scenario, {
    ...game,
    history: [...game.history, { outcomes, turnNumber: game.state.turnNumber }],
    locked: {},
    state: { ...game.state, turnNumber: game.state.turnNumber + 1 }
  });
}
