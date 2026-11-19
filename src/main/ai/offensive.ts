import { estimateAttack } from "../engine/combat";
import type { AiProfile, GameState, Scenario, TerritoryId, UnitState } from "../engine/types";
import type { Assessment } from "./assessment";
import { distancesTo } from "./choice";

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
    const massed = ready.filter((unit) => (distance.get(unit.territoryId) ?? Number.POSITIVE_INFINITY) <= assessment.profile.offensive.reach);
    if (massed.length === 0) continue;
    const estimate = estimateAttack(scenario, state, assessment.factionId, massed.map((unit) => unit.id), territory.id);
    if (estimate.kind !== "battle") continue;
    // Where no massed attack has a chance yet, the best odds still mark where to build up.
    const score = (estimate.takeChance + assessment.profile.offensive.oddsTieBreak * (estimate.attack / estimate.defence)) * assessment.stake(territory.id);
    if (best === undefined || score > best.score) {
      best = { offensive: { distance, massedTakeChance: estimate.takeChance, target: territory.id }, score };
    }
  }
  return best?.offensive;
}

/** The prize multiplier: more for the offensive target, and more the longer the faction has stalled. */
export function prizeFactor(weights: AiProfile["offensive"], offensive: Offensive | undefined, target: TerritoryId, stalled: number): number {
  const pressure = weights.stallStep * Math.min(stalled, weights.stallCap);
  return 1 + pressure + (offensive?.target === target ? weights.focus : 0);
}
