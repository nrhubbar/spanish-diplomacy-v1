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

/**
 * Section 2: every roll kind draws from its own seeded streams,
 * `deriveSeed(game seed, tag, turn, index)`. The battle tag is the Milestone 2 one, so battle
 * rolls are exactly those of Milestone 2. Each tag spells its kind in ASCII.
 */
export const rollStreamTags = {
  /** "airb": a battle's air battle (R11); the index is the battle's index in the turn. */
  "air-battle": 0x61697262,
  battle: battleStreamTag,
  /** "gend": a general's death roll (U5); the index is the death's order in the turn. */
  "general-death": 0x67656e64,
  /** "raid": an air raid's roll (U3); the index is the raid's order in the turn. */
  raid: 0x72616964,
  /** "weat": the turn's weather roll (T2); index 0 is the turn, 1 the forecast. */
  weather: 0x77656174
} as const;
export type RollKind = keyof typeof rollStreamTags;

/** One seeded stream of a roll kind for a turn. */
export function rollStream(seed: number, kind: RollKind, turnNumber: number, index: number): RandomSource {
  return seededRandom(deriveSeed(seed, rollStreamTags[kind], turnNumber, index));
}

/** A turn's streams for every roll kind, by kind and index. */
export type RollStreams = (kind: RollKind, index: number) => RandomSource;

export function seededRollStreams(seed: number, turnNumber: number): RollStreams {
  return (kind, index) => rollStream(seed, kind, turnNumber, index);
}

/** The turn's battle streams: `deriveSeed(game seed, battleStreamTag, turn, battle index)`. */
export function seededBattleDice(seed: number, turnNumber: number): BattleDice {
  return (battleIndex) => rollStream(seed, "battle", turnNumber, battleIndex);
}

/** The die every roll in the game uses: a d20. */
export const dieFaces = 20;

/** A whole number from 1 to `count`, each equally likely. */
export function pick(random: RandomSource, count: number): number {
  return 1 + Math.min(count - 1, Math.max(0, Math.floor(random() * count)));
}
