import { estimateAttack, oddsForValues, type BattleOdds } from "../engine/combat";
import { type GradedOdds, isGradedOdds } from "../engine/d20/odds";
import { usesD20 } from "../engine/d20/rules";
import type { FactionId, GameState, Scenario, TerritoryId, UnitState } from "../engine/types";
import type { Assessment } from "./assessment";
import type { Plan } from "./plan";

/** How a computer player weighs a battle's possible results against the prize. */
export interface AttackWeights {
  /**
   * Share of the danger at home that counts against sending armies away. Dangers assume
   * every hostile army nearby attacks that one territory, which overstates any single threat.
   */
  readonly caution: number;
  /** Share of a side's value that a demoralizing result costs it. */
  readonly demoralizedShare: number;
  /** Worth of each point of hostile value destroyed. */
  readonly enemyLoss: number;
  /** Cost of each point of own value lost. */
  readonly ownLoss: number;
}

/** One planned attack, or the occupation of an empty territory, and its score. */
export interface AttackPlan {
  readonly armies: readonly UnitState[];
  readonly score: number;
  readonly target: TerritoryId;
}

export interface AttackContext {
  readonly assessment: Assessment;
  readonly factionId: FactionId;
  /** Extra score for sending this army into the target, such as a penalty for a move that bounced last turn. */
  readonly moveBias: (unit: UnitState, target: TerritoryId) => number;
  readonly plan: Plan;
  /** What taking the territory is worth this turn: its stake, raised for an offensive or a stall. */
  readonly prize: (target: TerritoryId) => number;
  readonly scenario: Scenario;
  readonly state: GameState;
  readonly weights: AttackWeights;
}

/** Expected value lost by each side, in combat-value points, from the result distribution (M16). */
export function expectedLosses(odds: BattleOdds | GradedOdds, demoralizedShare: number): { readonly attacker: number; readonly defender: number } {
  if (isGradedOdds(odds)) {
    // D2: each grade costs a share of men and demoralizes a share of value.
    const { attack, defence, expected } = odds;
    return {
      attacker: attack * (expected.attackerLoss + expected.attackerDemoralized * demoralizedShare),
      defender: defence * (expected.defenderLoss + expected.defenderDemoralized * demoralizedShare)
    };
  }
  const { attack, chances, defence } = odds;
  // Attrition costs the paying side the opposing side's value, never more than it has.
  const attrition = Math.min(attack, defence);
  return {
    attacker: chances["attacker-eliminated"] * attack
      + (chances["attacker-attrition"] + chances["defender-exchange"]) * attrition
      + (chances["attacker-demoralized"] + chances["both-demoralized"]) * attack * demoralizedShare,
    defender: (chances["defender-eliminated"] + chances["defender-exchange"]) * defence
      + (chances["defender-demoralized"] + chances["both-demoralized"]) * defence * demoralizedShare
  };
}

/**
 * The best attack on one territory from the given candidate armies, which may stand in
 * several origins. An empty territory needs one army: the one cheapest to spare, and the
 * weakest among equals, so stronger armies stay free for battles. For a defended territory,
 * armies are added one at a time, each the cheapest to spare alongside those already chosen
 * and the strongest among equals, and the best-scoring group is kept: combining armies wins when the better odds
 * outweigh what their absence costs at home. Undefined when the territory is the faction's
 * own (moving there reinforces it, M11) or no army can be spared.
 */
export function bestAttackOn(
  context: AttackContext,
  target: TerritoryId,
  candidates: readonly UnitState[]
): AttackPlan | undefined {
  const { assessment, factionId, plan, scenario, state } = context;
  const [first] = candidates;
  if (first === undefined) return undefined;
  const kind = estimateAttack(scenario, state, factionId, [first.id], target).kind;
  if (kind === "reinforcement") return undefined;
  // An empty territory its owner can still relieve is fought for like a defended one.
  const contested = kind === "battle" || assessment.relief(target) !== undefined;
  const strongestFirst = contested ? 1 : -1;
  // Each step adds the army whose absence costs least given those already chosen, the
  // strongest among equals for a battle and the weakest for an empty territory.
  const next = (chosen: readonly UnitState[], remaining: readonly UnitState[]): { readonly cost: number; readonly unit: UnitState } | undefined => {
    let pick: { readonly cost: number; readonly unit: UnitState } | undefined;
    for (const unit of remaining) {
      const cost = plan.exposure([...chosen, unit]);
      if (cost === undefined) continue;
      const better = pick === undefined
        || cost < pick.cost
        || (cost === pick.cost && strongestFirst * (assessment.attackOf(unit) - assessment.attackOf(pick.unit)) > 0);
      if (better) pick = { cost, unit };
    }
    return pick;
  };

  let best: AttackPlan | undefined;
  const armies: UnitState[] = [];
  let remaining = [...candidates];
  const limit = contested ? candidates.length : 1;
  while (armies.length < limit) {
    const step = next(armies, remaining);
    if (step === undefined) break;
    armies.push(step.unit);
    remaining = remaining.filter((candidate) => candidate !== step.unit);
    const score = scoreAttack(context, target, armies, step.cost);
    if (best === undefined || score > best.score) best = { armies: [...armies], score, target };
  }
  return best;
}

/**
 * Take chance times the prize, plus the hostile value expected to be destroyed, minus the
 * own value expected to be lost and what the armies' absence costs at home. An empty
 * territory is simply the prize. `cost` is the armies' exposure at home (`Plan.exposure`).
 */
function scoreAttack(context: AttackContext, target: TerritoryId, armies: readonly UnitState[], cost: number): number {
  const { factionId, scenario, state, weights } = context;
  const bias = armies.reduce((sum, unit) => sum + context.moveBias(unit, target), 0);
  const home = weights.caution * cost;
  const estimate = estimateAttack(scenario, state, factionId, armies.map((unit) => unit.id), target);
  if (estimate.kind === "battle") {
    // D5: artillery alone would turn back; C6: attacking again tires, and at the top of the track demoralizes.
    if ("cannotAttack" in estimate && estimate.cannotAttack) return Number.NEGATIVE_INFINITY;
    return battleScore(context, target, estimate) - fatigueCost(context, armies) - home + bias;
  }
  const relief = context.assessment.relief(target);
  if (relief === undefined) return context.prize(target) - home + bias;
  // Its owner may move in first (M11): count that battle as likely as the dangers at home.
  const attack = armies.reduce((sum, unit) => sum + context.assessment.attackOf(unit), 0);
  const fought = battleScore(context, target, oddsForValues(scenario, state, {
    attackerFactionId: factionId,
    defenderFactionIds: [relief.factionId],
    diggingIn: true,
    territoryId: target
  }, attack, relief.defence));
  return (1 - weights.caution) * context.prize(target) + weights.caution * fought - home + bias;
}

/** Take chance times the prize, plus expected hostile losses, minus expected own losses. */
function battleScore(context: AttackContext, target: TerritoryId, odds: BattleOdds | GradedOdds): number {
  const { weights } = context;
  const losses = expectedLosses(odds, weights.demoralizedShare);
  // P4: on the d20 a partial grade takes some of the territory; count it at half the prize.
  const partial = isGradedOdds(odds) ? (odds.gainChance - odds.takeChance) / 2 : 0;
  return (odds.takeChance + partial) * context.prize(target)
    + weights.enemyLoss * losses.defender
    - weights.ownLoss * losses.attacker;
}

/**
 * C6, H5: on the d20, each attacking unit gains fatigue. A unit that this attack would take to
 * the demoralizing level is out of action until it rests (it cannot attack while demoralized,
 * and in contested ground only a general rallies it, C4), so it costs its whole attack value,
 * weighed as an own loss. The computer player rests worn units unless the prize is worth it.
 */
export function fatigueCost(context: AttackContext, armies: readonly UnitState[]): number {
  const { scenario, weights } = context;
  if (!usesD20(scenario) || scenario.d20 === undefined) return 0;
  const { demoralizedLevel } = scenario.d20.fatigue;
  return armies
    .filter((unit) => unit.fatigue + 1 >= demoralizedLevel)
    .reduce((sum, unit) => sum + weights.ownLoss * context.assessment.attackOf(unit), 0);
}
