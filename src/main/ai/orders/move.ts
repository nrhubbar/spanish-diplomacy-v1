import { estimateAttack } from "../../engine/combat";
import { neighborsOf } from "../../engine/lookup";
import type {
  FactionId,
  GameState,
  MoveOrder,
  Scenario,
  TerritoryId,
  UnitId,
  UnitState
} from "../../engine/types";
import { portLandings, railDepartures, unitTypeOf } from "../../engine/movement/network";
import { armyKey, describeRoute, legsOf, type MoveRoute, moveRoutes, routeClaims } from "../../engine/movement/routes";
import { armiesOf } from "../../engine/movement/transit";
import { validateMoveOrder } from "../../engine/validation";
import { assess, type Assessment } from "../assessment";
import { type AttackContext, type AttackPlan, bestAttackOn } from "../attacks";
import { type Cached, cached, distancesTo, forget, pickBest } from "../choice";
import { bouncedMoves, moveKey, stalledTurns } from "../memory";
import { chooseOffensive, prizeFactor } from "../offensive";
import { createPlan, type Plan } from "../plan";
import type { RandomSource } from "../../engine/random";
import type { OrderPlanner } from "./planner";

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
export const planMoves: OrderPlanner<MoveOrder> = ({ factionId, memory: context, random, scenario, state }) => {
  const assessment = assess(scenario, state, factionId);
  const weights = assessment.profile.computer;
  const own = Object.values(state.units).filter((unit) => unit.factionId === factionId);
  const plan = createPlan(assessment, own);
  const bounced = bouncedMoves(context.previousOutcomes ?? [], factionId);
  const moveBias = (unit: UnitState, to: TerritoryId): number =>
    bounced.has(moveKey(unit.id, unit.territoryId, to)) ? weights.bouncedLastTurn : 0;
  const ready = own.filter((unit) => !unit.morale.demoralized);
  const destinations = new Map(ready.map((unit) => [unit.id, legalMoves(scenario, state, unit).map((order) => order.to)]));
  const friendly = new Map(ready.map((unit) => [
    unit.id,
    (destinations.get(unit.id) ?? []).filter((to) => estimateAttack(scenario, state, factionId, [unit.id], to).kind === "reinforcement")
  ]));
  const distance = distancesTo(scenario, approachTargets(scenario, state, assessment));
  const offensive = chooseOffensive(scenario, state, assessment, ready);
  const stalled = stalledTurns(context.history ?? [], factionId);
  const prize = (target: TerritoryId): number => assessment.stake(target) * prizeFactor(assessment.profile.offensive, offensive, target, stalled);
  const staging = (unit: UnitState, to: TerritoryId): number => offensive === undefined
    ? 0
    : Math.max(0, (offensive.distance.get(unit.territoryId) ?? 0) - (offensive.distance.get(to) ?? 0)) * assessment.profile.offensive.staging;
  const attackContext: AttackContext = { assessment, factionId, moveBias, plan, prize, scenario, state, weights };

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
        best: bestReinforcement(plan, unit, targets, weights.caution, (to) =>
          Math.max(0, (distance.get(unit.territoryId) ?? 0) - (distance.get(to) ?? 0)) * weights.approachObjective
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
  return scenario.rules.movement === "allowance" ? withRoutes(scenario, state, factionId, plan.orders()) : plan.orders();
};

/**
 * M1-M5: the moves one unit could make. Under `allowance` each comes with the route the game
 * offers (`moveRoutes`), rail and sea included; the unit's allowance counts the trucks standing
 * with it, which `withRoutes` then sends along. Under `single-step`, one step along each connection.
 */
export function legalMoves(scenario: Scenario, state: GameState, unit: UnitState): readonly MoveOrder[] {
  if (scenario.rules.movement === "allowance") {
    // W5, AG-3: only units whose type may move march (never aircraft); trucks go with an army.
    if (isTransport(scenario, state, unit.id) || !(unitTypeOf(scenario, state, unit.id)?.orders.includes("move") ?? true)) return [];
    return [...unitRoutes(scenario, state, unit).values()]
      .map((route): MoveOrder => ({ factionId: unit.factionId, from: unit.territoryId, kind: "move", ...(route.shape === "step" ? {} : { legs: route.legs }), to: route.to, unitId: unit.id }));
  }
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
  caution: number,
  bonus: (to: TerritoryId) => number,
  random: RandomSource
): Reinforcement | undefined {
  const cost = plan.exposure([unit]);
  if (cost === undefined || targets.length === 0) return undefined;
  const options = targets.map((to) => ({
    score: caution * (plan.reinforcementGain(unit, to) - cost) + bonus(to),
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

/** Routes for a unit with the trucks standing with it, remembered per state for units alike (origin, mobility, morale). */
function unitRoutes(scenario: Scenario, state: GameState, unit: UnitState): ReadonlyMap<TerritoryId, MoveRoute> {
  const memo = routeMemo.get(state) ?? new Map<string, ReadonlyMap<TerritoryId, MoveRoute>>();
  routeMemo.set(state, memo);
  const mobile = (unitTypeOf(scenario, state, unit.id)?.effects ?? []).some((effect) => effect.kind === "mobile");
  const key = `${scenario.id}|${unit.factionId}|${unit.territoryId}|${String(mobile)}|${String(unit.morale.demoralized)}`;
  const known = memo.get(key);
  if (known !== undefined) return known;
  const trucks = Object.values(state.units).filter((other) => other.territoryId === unit.territoryId && other.factionId === unit.factionId && isTransport(scenario, state, other.id));
  const routes = moveRoutes(scenario, state, unit.factionId, unit.territoryId, [unit.id, ...trucks.map((truck) => truck.id)]);
  memo.set(key, routes);
  return routes;
}

const routeMemo = new WeakMap<GameState, Map<string, ReadonlyMap<TerritoryId, MoveRoute>>>();

function isTransport(scenario: Scenario, state: GameState, unitId: UnitId): boolean {
  return (unitTypeOf(scenario, state, unitId)?.effects ?? []).some((effect) => effect.kind === "transport");
}

/**
 * H5 for rail, trucks and sea (M1-M5). The planner chose destinations; this gives each order
 * the route the game offers for its unit, then checks the plan as armies (W4):
 * - free trucks go with the largest army leaving their territory, a marching one first;
 * - a march its army's trucks cannot carry is cut to its first step, into friendly ground;
 * - armies beyond a capital's departures, a port's landings or a lane's one assault stay home.
 */
export function withRoutes(scenario: Scenario, state: GameState, factionId: FactionId, planned: readonly MoveOrder[]): readonly MoveOrder[] {
  const own = Object.values(state.units).filter((unit) => unit.factionId === factionId);
  const routed = planned.map((order) => {
    const unit = state.units[order.unitId];
    const route = unit === undefined ? undefined : legalMoves(scenario, state, unit).find((move) => move.to === order.to);
    return route ?? order;
  });
  const ordered = new Set(routed.map((order) => order.unitId));
  const trucks = own.filter((unit) => !ordered.has(unit.id) && isTransport(scenario, state, unit.id));
  const result: MoveOrder[] = [...routed];
  for (const truck of trucks) {
    const leaving = armiesOf((order) => armyKey(scenario, order), result.filter((order) => order.from === truck.territoryId));
    const marching = leaving.filter((army) => (army.orders[0]?.legs?.length ?? 1) > 1 && army.orders[0]?.legs?.every((leg) => leg.kind === "land") === true);
    const target = [...marching, ...leaving].sort((left, right) => right.orders.length - left.orders.length)[0]?.orders[0];
    if (target !== undefined) result.push({ ...target, unitId: truck.id });
  }
  const fitted = result.map((order) => {
    const legs = order.legs ?? [];
    if (legs.length < 2 || !legs.every((leg) => leg.kind === "land")) return order;
    const army = result.filter((other) => armyKey(scenario, other) === armyKey(scenario, order)).map((other) => other.unitId);
    const route = moveRoutes(scenario, state, factionId, order.from, army).get(order.to);
    if (route !== undefined && route.legs.length === legs.length && route.legs.every((leg, index) => leg.to === legs[index]?.to)) return order;
    const first = legs[0];
    return first === undefined ? order : { ...order, legs: [first], to: first.to };
  });
  const usable: MoveOrder[] = [];
  const counts = { departures: new Map<string, number>(), landings: new Map<string, number>(), lanes: new Map<string, number>() };
  for (const army of armiesOf((order) => armyKey(scenario, order), fitted)) {
    const [first] = army.orders;
    if (first === undefined) continue;
    const check = describeRoute(scenario, state, factionId, first.from, legsOf(scenario, first), true);
    if (!check.ok) continue;
    const claims = routeClaims(check.route);
    const fits = (map: Map<string, number>, key: string | undefined, limit: number): boolean => key === undefined || (map.get(key) ?? 0) < limit;
    if (!fits(counts.departures, claims.departure, claims.departure === undefined ? 0 : railDepartures(scenario, state, claims.departure))
      || !fits(counts.landings, claims.landing, portLandings(scenario, check.route.sea?.level ?? 0))
      || !fits(counts.lanes, claims.amphibious, 1)) continue;
    for (const [map, key] of [[counts.departures, claims.departure], [counts.landings, claims.landing], [counts.lanes, claims.amphibious]] as const) {
      if (key !== undefined) map.set(key, (map.get(key) ?? 0) + 1);
    }
    usable.push(...army.orders);
  }
  return usable;
}
