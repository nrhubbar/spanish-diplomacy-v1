import type { FactionId, GameState, Scenario } from "../engine/types";

const inFull = new Intl.NumberFormat("en-GB");

/** A number of men in full: "36,993". */
export function menInFull(men: number): string {
  return inFull.format(men);
}

/** A number of men in short, to one decimal: "950", "12.4k", "37k", "1.2M". */
export function menInShort(men: number): string {
  if (men < 1000) return String(men);
  const thousands = Math.round(men / 100) / 10;
  return thousands < 1000 ? `${String(thousands)}k` : `${String(Math.round(men / 100_000) / 10)}M`;
}

export interface CasualtiesView {
  /** Every faction in scenario order. */
  readonly sides: readonly { readonly factionId: FactionId; readonly men: number; readonly name: string }[];
  readonly total: number;
}

/** The men every side has lost since the first turn. */
export function casualtiesView(scenario: Scenario, { casualties }: Pick<GameState, "casualties">): CasualtiesView {
  const sides = scenario.factions.map(({ id, name }) => ({ factionId: id, men: casualties?.[id] ?? 0, name }));
  return { sides, total: sides.reduce((sum, side) => sum + side.men, 0) };
}
