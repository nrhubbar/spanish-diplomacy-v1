export type RandomSource = () => number;

/** mulberry32: small, fast, deterministic PRNG returning values in [0, 1). */
export function seededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derives an independent stream seed from a game seed and any number of integers. */
export function deriveSeed(seed: number, ...parts: readonly number[]): number {
  let hash = seed >>> 0;
  for (const part of parts) {
    hash = Math.imul(hash ^ (part >>> 0), 0x9e3779b1) >>> 0;
    hash = (hash ^ (hash >>> 16)) >>> 0;
  }
  return hash;
}
