import { estimateAttack } from "../engine/combat";
import { neighborsOf } from "../engine/lookup";
import type { RandomSource } from "../engine/random";
import type {
  FactionId,
  GameState,
  MoveOrder,
  PlayerSubmission,
  Scenario,
  TerritoryId,
  TurnOutcome,
  UnitId,
  UnitState
} from "../engine/types";
import { validateMoveOrder } from "../engine/validation";
import { assess, type Assessment } from "./assessment";
import { type AttackContext, type AttackPlan, bestAttackOn } from "./attacks";
import { type Cached, cached, distancesTo, forget, pickBest } from "./choice";
import { bouncedMoves, moveKey, stalledTurns } from "./memory";
import { chooseOffensive, offensiveWeights, prizeFactor } from "./offensive";
import { createPlan, type Plan } from "./plan";

/**
 * Public information a computer player may use. It sees exactly what a human sees: the board
 * and the revealed outcomes of the previous turn, never another faction's pending orders.
 */
export interface ComputerPlayerContext {
  /** Every earlier turn's outcomes, oldest first. */
  readonly history?: readonly (readonly TurnOutcome[])[];
  readonly previousOutcomes?: readonly TurnOutcome[];
}

/**
 * Scoring weights, exported so tests and the soak run can reason about them. Prizes and
 * dangers are measured by territory stakes (`stakeWeights`), losses in combat-value points.
 */
export const computerWeights = {
  /** Per step closer to an objective the faction does not hold, for a move through friendly ground. */
  approachObjective: 1.5,
  /** Per army, for repeating a move that bounced last turn. */
  bouncedLastTurn: -4,
  /** Share of a danger counted when moving armies (see `AttackWeights.caution`). */
  caution: 0.5,
  /** Share of a side's value that a demoralizing result costs it. */
  demoralizedShare: 0.25,
  /** Per point of hostile value expected to be destroyed. */
  enemyLoss: 0.5,
  /** Per point of own value expected to be lost. */
  ownLoss: 0.75
} as const;

/**
 * C18: an odds-aware computer player. It reads the board through the engine's own battle
 * maths (`estimateAttack`, `battleOdds`) and plans greedily, one decision at a time, taking
 * whichever scores best of:
 *
 * - An attack. Each territory it does not hold is scored by its best group of armies from
 *   any adjacent origins: take chance times the prize, plus expected hostile losses, minus
 *   expected own losses and the danger the armies' absence leaves at home.
 * - A reinforcement. An army moves into its own territory where its defence lowers the danger
 *   there by more than its absence raises it at home, or steps toward an objective through
 *   friendly ground. Because both kinds compete in one queue, a threatened objective is
 *   defended before a lesser prize is taken.
 *
 * Planning stops when nothing scores above holding. Only the decisions an order changes are
 * scored again. Demoralized armies always hold: they cannot attack (M23), and a quiet turn
 * restores them. The last army on an objective never leaves it. Randomness only breaks exact
 * ties, from the seeded source, so a seed always produces the same orders.
 */
export function generateComputerSubmission(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  random: RandomSource,
  context: ComputerPlayerContext = {}
): PlayerSubmission {
  const assessment = assess(scenario, state, factionId);
  const own = Object.values(state.units).filter((unit) => unit.factionId === factionId);
  const plan = createPlan(assessment, own);
  const bounced = bouncedMoves(context.previousOutcomes ?? [], factionId);
  const moveBias = (unit: UnitState, to: TerritoryId): number =>
    bounced.has(moveKey(unit.id, unit.territoryId, to)) ? computerWeights.bouncedLastTurn : 0;
  const ready = own.filter((unit) => !unit.morale.demoralized);
  const destinations = new Map(ready.map((unit) => [unit.id, legalMoves(scenario, state, unit).map((order) => order.to)]));
  const friendly = new Map(ready.map((unit) => [
    unit.id,
    (destinations.get(unit.id) ?? []).filter((to) => estimateAttack(scenario, state, factionId, [unit.id], to).kind === "reinforcement")
  ]));
  const distance = distancesTo(scenario, approachTargets(scenario, state, assessment));
  const offensive = chooseOffensive(scenario, state, assessment, ready);
  const stalled = stalledTurns(context.history ?? [], factionId);
  const prize = (target: TerritoryId): number => assessment.stake(target) * prizeFactor(offensive, target, stalled);
  const staging = (unit: UnitState, to: TerritoryId): number => offensive === undefined
    ? 0
    : Math.max(0, (offensive.distance.get(unit.territoryId) ?? 0) - (offensive.distance.get(to) ?? 0)) * offensiveWeights.staging;
  const attackContext: AttackContext = { assessment, factionId, moveBias, plan, prize, scenario, state, weights: computerWeights };

  const attacks = new Map<TerritoryId, Cached<AttackPlan>>();
  const reinforcements = new Map<UnitId, Cached<Reinforcement>>();
  const attacked = new Set<TerritoryId>();
  for (;;) {
    const options: Decision[] = [];
    for (const territory of scenario.territories) {
      if (attacked.has(territory.id)) continue;
      const scored = cached(attacks, territory.id, () => {
        const candidates = ready.filter((unit) => plan.isFree(unit) && (destinations.get(unit.id) ?? []).includes(territory.id));
        return {
          best: bestAttackOn(attackContext, territory.id, candidates),
          depends: new Set(candidates.flatMap((unit): string[] => [unit.id, unit.territoryId]))
        };
      });
      if (scored.best !== undefined && scored.best.score > 0) options.push({ kind: "attack", ...scored.best });
    }
    for (const unit of ready) {
      if (!plan.isFree(unit)) continue;
      const targets = friendly.get(unit.id) ?? [];
      const scored = cached(reinforcements, unit.id, () => ({
        best: bestReinforcement(plan, unit, targets, (to) =>
          Math.max(0, (distance.get(unit.territoryId) ?? 0) - (distance.get(to) ?? 0)) * computerWeights.approachObjective
          + staging(unit, to)
          + moveBias(unit, to), random),
        depends: new Set([unit.id, unit.territoryId, ...targets])
      }));
      if (scored.best !== undefined && scored.best.score > 0) options.push({ kind: "reinforcement", ...scored.best });
    }

    const chosen = pickBest(options, (option) => option.score, random);
    if (chosen === undefined) break;
    let changed: readonly string[];
    if (chosen.kind === "attack") {
      attacked.add(chosen.target);
      for (const unit of chosen.armies) plan.commit(unit, chosen.target, false);
      changed = chosen.armies.flatMap((unit): string[] => [unit.id, unit.territoryId]);
    } else {
      plan.commit(chosen.unit, chosen.to, true);
      changed = [chosen.unit.id, chosen.unit.territoryId, chosen.to];
    }
    forget(attacks, changed);
    forget(reinforcements, changed);
  }
  return { factionId, orders: plan.orders() };
}

export function legalMoves(scenario: Scenario, state: GameState, unit: UnitState): readonly MoveOrder[] {
  return neighborsOf(scenario, unit.territoryId)
    .map((neighbor): MoveOrder => ({
      factionId: unit.factionId,
      from: unit.territoryId,
      kind: "move",
      to: neighbor.territoryId,
      unitId: unit.id
    }))
    .filter((order) => validateMoveOrder(scenario, state, order).ok);
}

interface Reinforcement {
  readonly score: number;
  readonly to: TerritoryId;
  readonly unit: UnitState;
}

type Decision = ({ readonly kind: "attack" } & AttackPlan) | ({ readonly kind: "reinforcement" } & Reinforcement);

/** The army's best move into its own territory: danger removed there, minus danger left at home. */
function bestReinforcement(
  plan: Plan,
  unit: UnitState,
  targets: readonly TerritoryId[],
  bonus: (to: TerritoryId) => number,
  random: RandomSource
): Reinforcement | undefined {
  const cost = plan.exposure([unit]);
  if (cost === undefined || targets.length === 0) return undefined;
  const options = targets.map((to) => ({
    score: computerWeights.caution * (plan.reinforcementGain(unit, to) - cost) + bonus(to),
    to,
    unit
  }));
  return pickBest(options, (option) => option.score, random);
}

/** Objectives the faction does not control yet; all of them once it controls every one. */
function approachTargets(scenario: Scenario, state: GameState, assessment: Assessment): ReadonlySet<TerritoryId> {
  const objectives = scenario.territories.filter((territory) => assessment.isObjective(territory.id)).map((territory) => territory.id);
  const remaining = objectives.filter((territoryId) => {
    const control = state.control[territoryId];
    return !(control?.kind === "controlled" && control.factionId === assessment.factionId);
  });
  return new Set(remaining.length > 0 ? remaining : objectives);
}
