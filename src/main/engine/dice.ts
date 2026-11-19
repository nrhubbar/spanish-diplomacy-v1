import { dieFaces } from "./combat";
import { deriveSeed, type RandomSource, seededRandom } from "./random";

/**
 * M26: every battle of a turn draws from its own random stream, chosen by the battle's index.
 * The first draw is the battle's die; a standing battle (M27) draws its tie-break rolls after it.
 */
export type BattleDice = (battleIndex: number) => RandomSource;

/**
 * Keeps battle streams apart from every other stream derived from the game seed. Computer
 * players draw from `deriveSeed(seed, turn, factionIndex)`; without this tag, battle 0 would
 * replay the first computer player's stream.
 */
export const battleStreamTag = 0x62617474;

/** The turn's battle streams: `deriveSeed(game seed, battleStreamTag, turn, battle index)`. */
export function seededBattleDice(seed: number, turnNumber: number): BattleDice {
  return (battleIndex) => seededRandom(deriveSeed(seed, battleStreamTag, turnNumber, battleIndex));
}

/** A face of the six-sided battle die. */
export function rollDie(random: RandomSource): number {
  return pick(random, dieFaces.length);
}

/** A whole number from 1 to `count`, each equally likely. */
export function pick(random: RandomSource, count: number): number {
  return 1 + Math.min(count - 1, Math.max(0, Math.floor(random() * count)));
}
