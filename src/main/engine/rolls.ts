import { type RollKind, rollStream } from "./dice";
import { deriveSeed, type RandomSource, seededRandom } from "./random";
import { hmacSha256 } from "./sha256";

/**
 * Where a game's chance comes from: one independent stream per kind of roll, turn and index.
 * Only whoever resolves turns holds one; a player's copy of the game never does.
 */
export interface RollSource {
  /** A computer player's own stream for a turn, by its faction's index in the scenario. */
  readonly computer: (turnNumber: number, factionIndex: number) => RandomSource;
  readonly stream: (kind: RollKind, turnNumber: number, index: number) => RandomSource;
}

/**
 * The 32-bit source the balance harness and tests replay. Its seed can be worked out from the
 * dice a player sees, so games between people use `keyedRolls`.
 */
export function numericRolls(seed: number): RollSource {
  return {
    computer: (turnNumber, factionIndex) => seededRandom(deriveSeed(seed, turnNumber, factionIndex)),
    stream: (kind, turnNumber, index) => rollStream(seed, kind, turnNumber, index)
  };
}

const wordsPerBlock = 8;

/** HMAC-SHA-256 in counter mode over the stream's name: draws reveal nothing about the key. */
function keyedStream(key: string, name: string): RandomSource {
  let block: readonly number[] = [];
  let drawn = 0;
  return () => {
    const position = drawn % wordsPerBlock;
    if (position === 0) block = hmacSha256(key, `${name}:${String(drawn / wordsPerBlock)}`);
    drawn += 1;
    return (block[position] ?? 0) / 0x100000000;
  };
}

/** A game's dice from its text seed. As hard to predict as the seed is to guess. */
export function keyedRolls(seed: string): RollSource {
  return {
    computer: (turnNumber, factionIndex) => keyedStream(seed, `computer:${String(turnNumber)}:${String(factionIndex)}`),
    stream: (kind, turnNumber, index) => keyedStream(seed, `${kind}:${String(turnNumber)}:${String(index)}`)
  };
}

/** A roll source, or the seed of a `numericRolls` one. */
export type Rolls = number | RollSource;

export function rollSource(rolls: Rolls): RollSource {
  return typeof rolls === "number" ? numericRolls(rolls) : rolls;
}
