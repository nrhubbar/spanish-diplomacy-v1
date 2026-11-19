import { estimateAttack } from "../engine/combat";
import type { GameState, Scenario, TerritoryId, UnitState } from "../engine/types";
import type { Assessment } from "./assessment";
import { distancesTo } from "./choice";

/** How a computer player runs an offensive over several turns. */
export const offensiveWeights = {
  /** Armies this many steps from the target or closer count toward the force it could mass. */
  reach: 3,
  /** Weight of the massed odds ratio when choosing a target, so a build-up has a direction even before it has a chance. */
  oddsTieBreak: 0.02,
  /** Per step closer to the offensive target, for a move through friendly ground. */
  staging: 2,
  /** Added share of the prize for attacking the offensive target. */
  focus: 1,
  /** Added share of every prize for each turn in a row without a gain, up to `stallCap`. */
  stallStep: 1,
  stallCap: 4
} as const;

/** The territory a faction is massing against this turn, and what it is worth to win it. */
export interface Offensive {
  /** Take chance if every ready army within reach attacked together. */
  readonly massedTakeChance: number;
  readonly target: TerritoryId;
  /** Steps from every territory to the target. */
  readonly distance: ReadonlyMap<TerritoryId, number>;
}

/**
 * The offensive target: of the territories hostile armies hold, the one where the faction's
 * ready armies within reach, massed together, would score the best take chance times the
 * stake. Ties go to scenario order. Undefined when no massed attack has any chance.
 */
export function chooseOffensive(
  scenario: Scenario,
  state: GameState,
  assessment: Assessment,
  ready: readonly UnitState[]
): Offensive | undefined {
  // Armies mass through friendly ground: territory the faction controls or stands in.
  const friendly = new Set<TerritoryId>(ready.map((unit) => unit.territoryId));
  for (const { id } of scenario.territories) {
    const control = state.control[id];
    if (control?.kind === "controlled" && control.factionId === assessment.factionId) friendly.add(id);
  }
  let best: { readonly score: number; readonly offensive: Offensive } | undefined;
  for (const territory of scenario.territories) {
    const distance = distancesTo(scenario, new Set([territory.id]), (territoryId) => friendly.has(territoryId));
    const massed = ready.filter((unit) => (distance.get(unit.territoryId) ?? Number.POSITIVE_INFINITY) <= offensiveWeights.reach);
    if (massed.length === 0) continue;
    const estimate = estimateAttack(scenario, state, assessment.factionId, massed.map((unit) => unit.id), territory.id);
    if (estimate.kind !== "battle") continue;
    // Where no massed attack has a chance yet, the best odds still mark where to build up.
    const score = (estimate.takeChance + offensiveWeights.oddsTieBreak * (estimate.attack / estimate.defence)) * assessment.stake(territory.id);
    if (best === undefined || score > best.score) {
      best = { offensive: { distance, massedTakeChance: estimate.takeChance, target: territory.id }, score };
    }
  }
  return best?.offensive;
}

/** The prize multiplier: more for the offensive target, and more the longer the faction has stalled. */
export function prizeFactor(offensive: Offensive | undefined, target: TerritoryId, stalled: number): number {
  const pressure = offensiveWeights.stallStep * Math.min(stalled, offensiveWeights.stallCap);
  return 1 + pressure + (offensive?.target === target ? offensiveWeights.focus : 0);
}
