import { type AttackEstimate, estimateAttack } from "../engine/combat";
import type { CombatModifier, FactionId, GameState, MoveOrder, Scenario, TerritoryId, UnitId } from "../engine/types";
import { glyphs } from "./glyphs";

/**
 * C15: what a planned move would meet, for the destination highlights and the Orders pane.
 * The numbers come from the engine's `estimateAttack`; this module only adds the words. The
 * destinations are the engine's legal ones, so a demoralized army is never offered a hostile
 * territory (M23) and needs no case here.
 */
export type DestinationEstimate = AttackEstimate;

/**
 * A1: the odds at each destination count every army this faction would send there: the
 * selected armies plus the planned moves to that destination, each army once. A selected army
 * that already has a planned order is counted once, where it is about to go.
 */
export function destinationEstimates(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  unitIds: readonly UnitId[],
  destinations: readonly TerritoryId[],
  plannedOrders: readonly MoveOrder[] = []
): ReadonlyMap<TerritoryId, DestinationEstimate> {
  const estimates = new Map<TerritoryId, DestinationEstimate>();
  if (unitIds.length === 0) return estimates;
  for (const territoryId of destinations) {
    const attackers = new Set([...unitIds, ...plannedAttackers(plannedOrders, factionId, territoryId)]);
    estimates.set(territoryId, estimateAttack(scenario, state, factionId, [...attackers], territoryId));
  }
  return estimates;
}

/**
 * A1 (B.2): the combined odds of everything this faction has ordered to each destination of
 * its planned moves, in the order the destinations first appear.
 */
export function plannedEstimates(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  plannedOrders: readonly MoveOrder[]
): ReadonlyMap<TerritoryId, DestinationEstimate> {
  const destinations = new Set(plannedOrders.filter((order) => order.factionId === factionId).map((order) => order.to));
  const estimates = new Map<TerritoryId, DestinationEstimate>();
  for (const territoryId of destinations) {
    estimates.set(territoryId, estimateAttack(scenario, state, factionId, plannedAttackers(plannedOrders, factionId, territoryId), territoryId));
  }
  return estimates;
}

/** The armies of `factionId` with a planned move into `territoryId`. */
function plannedAttackers(plannedOrders: readonly MoveOrder[], factionId: FactionId, territoryId: TerritoryId): readonly UnitId[] {
  return plannedOrders
    .filter((order) => order.factionId === factionId && order.to === territoryId)
    .map((order) => order.unitId);
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
  /** Short text for the map plaque: "\u2248 2:1 - 50%", "Reinforce", "Unopposed". */
  readonly chip: string;
  /** The same for the Orders pane, where there is room for the word: "Approx. 2:1 - 50%". */
  readonly label: string;
  /** The same in words, for accessible names: "Approximately 2:1, 50 percent to take it." */
  readonly sentence: string;
  readonly tone: OddsTone;
}

/**
 * A2: battle odds are an estimate (the defender may reinforce, another faction may join), so
 * they always read as approximate. Reinforcement and unopposed moves are not odds.
 */
export function oddsSummary(estimate: DestinationEstimate): OddsSummary {
  switch (estimate.kind) {
    case "reinforcement":
      return { chip: "Reinforce", label: "Reinforce", sentence: "Reinforcement: it always arrives and joins the defence.", tone: "safe" };
    case "unopposed":
      return { chip: "Unopposed", label: "Unopposed", sentence: "Unopposed: no other faction's army is there.", tone: "safe" };
    case "battle": {
      const odds = `${estimate.oddsLabel} ${glyphs.dot} ${percent(estimate.takeChance)}`;
      return {
        chip: `${glyphs.approx} ${odds}`,
        label: `Approx. ${odds}`,
        sentence: `Approximately ${estimate.oddsLabel}, ${String(Math.round(estimate.takeChance * 100))} percent to take it.`,
        tone: chanceTone(estimate.takeChance)
      };
    }
  }
}

/** A2: the one sentence behind the odds' "i". */
export const oddsCaveat = "The defender may reinforce, or another faction may attack too, so the real odds may differ.";

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
