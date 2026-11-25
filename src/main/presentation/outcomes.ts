import { unitKindIn } from "../engine/air/pieces";
import { type BattleResult, battleResults, type GameState, type Scenario, type TurnOutcome } from "../engine/types";

/**
 * Outcome keys (Milestone 2 Revision 6, section 2.1): the stable names icons, emblems, and
 * report text are keyed by. Keys only; the words live with the presentation that shows them.
 */

/** The seven battle results, worst to best for the attacker. The engine's own list. */
export const resultKeys: readonly BattleResult[] = battleResults;
export type ResultKey = BattleResult;

/** The five army and territory statuses. */
export const statusKeys = [
  "demoralized",
  "dug-in",
  "recovered",
  "reinforcement-arrived",
  "surrendered"
] as const;
export type StatusKey = (typeof statusKeys)[number];

export type OutcomeKey = ResultKey | StatusKey;

/** Every outcome key: results first, then statuses. */
export const outcomeKeys: readonly OutcomeKey[] = [...resultKeys, ...statusKeys];

/** How many armies held. Aircraft and generals have no order to hold on ($6: holds come from public orders, T6). */
export function holdCount(scenario: Scenario, result: { readonly finalState: Pick<GameState, "raised">; readonly outcomes: readonly TurnOutcome[] }): number {
  return result.outcomes.filter((outcome) => outcome.kind === "no-move" && outcome.unitId !== undefined
    && unitKindIn(scenario, result.finalState.raised, outcome.unitId) === "ground").length;
}
