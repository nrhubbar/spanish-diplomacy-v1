import { type AttackEstimate, estimateAttack } from "../engine/combat";
import type { CombatModifier, FactionId, GameState, Scenario, TerritoryId, UnitId } from "../engine/types";
import { glyphs } from "./glyphs";

/**
 * C15: what a planned move would meet, for the destination highlights and the Orders pane.
 * The numbers come from the engine's `estimateAttack`; this module only adds the words. The
 * destinations are the engine's legal ones, so a demoralized army is never offered a hostile
 * territory (M23) and needs no case here.
 */
export type DestinationEstimate = AttackEstimate;

export function destinationEstimates(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  unitIds: readonly UnitId[],
  destinations: readonly TerritoryId[]
): ReadonlyMap<TerritoryId, DestinationEstimate> {
  const estimates = new Map<TerritoryId, DestinationEstimate>();
  if (unitIds.length === 0) return estimates;
  for (const territoryId of destinations) {
    estimates.set(territoryId, estimateAttack(scenario, state, factionId, unitIds, territoryId));
  }
  return estimates;
}

/** A chance as a whole percentage: 0.5 is "50%". */
export function percent(chance: number): string {
  return `${String(Math.round(chance * 100))}%`;
}

export type OddsTone = "good" | "even" | "poor" | "safe";

/** How a take chance reads at a glance; the words always carry the number too. */
export function chanceTone(chance: number): OddsTone {
  if (chance >= 2 / 3) return "good";
  return chance <= 1 / 3 ? "poor" : "even";
}

export interface OddsSummary {
  /** Short text for the map highlight: "2:1 - 50%", "Reinforce", "Unopposed". */
  readonly chip: string;
  /** The same in words, for the pane and accessible names. */
  readonly sentence: string;
  readonly tone: OddsTone;
}

export function oddsSummary(estimate: DestinationEstimate): OddsSummary {
  switch (estimate.kind) {
    case "reinforcement":
      return { chip: "Reinforce", sentence: "Reinforcement: it always arrives and joins the defence.", tone: "safe" };
    case "unopposed":
      return { chip: "Unopposed", sentence: "Unopposed: no other faction's army is there.", tone: "safe" };
    case "battle":
      return {
        chip: `${estimate.oddsLabel} ${glyphs.dot} ${percent(estimate.takeChance)}`,
        sentence: `Battle at ${estimate.oddsLabel}: ${percent(estimate.takeChance)} to take it.`,
        tone: chanceTone(estimate.takeChance)
      };
  }
}

/** Signed roll change as printed: "+1", "-2" (with a true minus sign), "0". */
export function signed(value: number): string {
  if (value > 0) return `+${String(value)}`;
  return value < 0 ? `${glyphs.minus}${String(-value)}` : "0";
}

/**
 * A modifier by name, as the battle breakdown lists it. Defender bonuses read as the bonus
 * ("Dug in +2", "Popular resistance +1"); the roll column shows their effect on the die.
 */
export function modifierName(modifier: CombatModifier): string {
  switch (modifier.kind) {
    case "dug-in":
      return `Dug in +${String(modifier.level)}`;
    case "faction":
      return `${modifier.name} +${String(Math.abs(modifier.roll))}`;
    case "odds-overflow":
      return "Odds beyond 6:1";
    case "odds-halving":
      return `Odds below 1:1 (${String(modifier.halvings)} ${modifier.halvings === 1 ? "halving" : "halvings"})`;
  }
}

/** A modifier as one phrase: defender bonuses by name, odds steps with their roll change. */
export function modifierPhrase(modifier: CombatModifier): string {
  return modifier.kind === "odds-overflow" || modifier.kind === "odds-halving"
    ? `${modifierName(modifier)} ${signed(modifier.roll)}`
    : modifierName(modifier);
}
