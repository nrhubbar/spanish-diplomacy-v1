import { type DugInLevel, outcomeEmblem, outcomeMedallion } from "../assets/outcomes/art";
import type { OutcomeKey } from "./outcomes";

/**
 * Memoized outcome art. Medallion and emblem markup is sanitized and serialized on first use;
 * the map draws the same few combinations many times, so each is built once per session.
 */
const cache = new Map<string, string>();

function memo(key: string, build: () => string): string {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const markup = build();
  cache.set(key, markup);
  return markup;
}

/** Works levels the art can show; deeper works show the deepest pips. */
export function artLevel(level: number): DugInLevel {
  if (level >= 3) return 3;
  return level <= 1 ? 1 : 2;
}

export function medallionMarkup(key: OutcomeKey, ring: string, level = 1): string {
  return memo(`m:${key}:${ring}:${String(level)}`, () => outcomeMedallion(key, { level: artLevel(level), ring }));
}

export function emblemMarkup(key: OutcomeKey, level = 1): string {
  return memo(`e:${key}:${String(level)}`, () => outcomeEmblem(key, { level: artLevel(level) }));
}
