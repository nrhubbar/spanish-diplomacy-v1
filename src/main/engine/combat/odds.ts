import type { TurnScratch } from "../phases/draft";
import type { CombatRole, FactionId, TerritoryId, UnitId } from "../types";
import { lastColumn } from "./values";

/** M13: the odds of one battle, always rounded in the defender's favour. */
export interface Odds {
  /** Table column: 0 below 1:1, otherwise the odds up to 6:1. */
  readonly column: number;
  /** Below 1:1, how many times the rounded odds halve from 1:1 (1:2 and 1:3 are 1; 1:4 to 1:7 are 2). */
  readonly halvings: number;
  /** The rounded odds as players read them: "3:1", "8:1", or "1:3". */
  readonly label: string;
  /** Steps beyond 6:1, each added to the roll. */
  readonly overflow: number;
}

/**
 * M13: at or above 1:1 the odds are floor(attack / defence):1; below it they are
 * 1:ceil(defence / attack). Both sides must be positive whole numbers.
 */
export function oddsFor(attack: number, defence: number): Odds {
  requireSideValue(attack, "attack");
  requireSideValue(defence, "defence");
  if (attack >= defence) {
    const ratio = Math.floor(attack / defence);
    return {
      column: Math.min(ratio, lastColumn),
      halvings: 0,
      label: `${String(ratio)}:1`,
      overflow: Math.max(0, ratio - lastColumn)
    };
  }
  const against = Math.ceil(defence / attack);
  return { column: 0, halvings: halvingsOf(against), label: `1:${String(against)}`, overflow: 0 };
}

/**
 * Who fights where, for the modifiers that depend on the situation. Head-on meeting battles
 * (M20) take no situational modifiers at all, so they need no context.
 */
export interface BattleContext {
  readonly attackerFactionId: FactionId;
  /** The attacking units, when known (planning estimates), so a general with them counts. */
  readonly attackerUnitIds?: readonly UnitId[];
  /** R11: the battle's index while the turn resolves, for its air battle's rolls. */
  readonly battleIndex?: number;
  readonly defenderFactionIds: readonly FactionId[];
  /** R11: the defending units, whose AA joins the air battle. */
  readonly defenderUnitIds?: readonly UnitId[];
  /** Whether the territory's works count: false for empty-territory entries (M19). */
  readonly diggingIn: boolean;
  /** The turn's scratch, passed on to the hooks while a turn resolves (air support, generals). */
  readonly scratch?: TurnScratch;
  readonly territoryId: TerritoryId;
}

/** How many times `against` can be halved and stay at or above 1, so 1:2 is one halving. */
function halvingsOf(against: number): number {
  let halvings = 0;
  while (2 ** (halvings + 1) <= against) {
    halvings += 1;
  }
  return halvings;
}

function requireSideValue(value: number, side: CombatRole): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invariant violated: the ${side} value must be a positive whole number, not ${String(value)}.`);
  }
}
