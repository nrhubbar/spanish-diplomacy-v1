import { type BattleResult, battleResults } from "../engine/types";

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
