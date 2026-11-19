import { neighborsOf } from "../engine/lookup";
import type { RandomSource } from "../engine/random";
import type { Scenario, TerritoryId } from "../engine/types";

/** Small planning helpers shared by the computer player's modules. */

/** The highest-scoring entry; an exact tie is broken by the seeded random source. */
export function pickBest<Entry>(entries: readonly Entry[], score: (entry: Entry) => number, random: RandomSource): Entry | undefined {
  if (entries.length <= 1) return entries[0];
  const best = Math.max(...entries.map(score));
  const tied = entries.filter((entry) => score(entry) === best);
  return tied.length === 1 ? tied[0] : tied[Math.min(tied.length - 1, Math.floor(random() * tied.length))];
}

/** Breadth-first distance to the nearest target from every territory reached through passable ones. */
export function distancesTo(
  scenario: Scenario,
  targets: ReadonlySet<TerritoryId>,
  passable: (territoryId: TerritoryId) => boolean = () => true
): ReadonlyMap<TerritoryId, number> {
  const distance = new Map<TerritoryId, number>();
  let frontier = [...targets];
  for (const target of frontier) distance.set(target, 0);
  let step = 0;
  while (frontier.length > 0) {
    step += 1;
    const next: TerritoryId[] = [];
    for (const territoryId of frontier) {
      for (const neighbor of neighborsOf(scenario, territoryId)) {
        if (!distance.has(neighbor.territoryId) && passable(neighbor.territoryId)) {
          distance.set(neighbor.territoryId, step);
          next.push(neighbor.territoryId);
        }
      }
    }
    frontier = next;
  }
  return distance;
}

/** A scored decision, kept until a planned order touches one of the keys it depends on. */
export interface Cached<Best> {
  readonly best: Best | undefined;
  /** Army ids and territory ids whose change makes the score stale. */
  readonly depends: ReadonlySet<string>;
}

export function cached<Key, Value>(cache: Map<Key, Value>, key: Key, compute: () => Value): Value {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = compute();
  cache.set(key, value);
  return value;
}

export function forget<Key, Best>(cache: Map<Key, Cached<Best>>, changed: readonly string[]): void {
  for (const [key, entry] of cache) {
    if (changed.some((item) => entry.depends.has(item))) cache.delete(key);
  }
}
