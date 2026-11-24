import { estimateAttack } from "../../engine/combat";
import { neighborsOf } from "../../engine/lookup";
import type {
  FactionId,
  GameState,
  MoveOrder,
  Scenario,
  SubTerritoryId,
  TerritoryId,
  UnitId,
  UnitState
} from "../../engine/types";
import { portLandings, railCapacity, railPlaces, unitTypeOf } from "../../engine/movement/network";
import { armyKey, boardingRefusal, describeRoute, legsOf, moveRoutes, routeClaims } from "../../engine/movement/routes";
import { armiesOf } from "../../engine/movement/transit";
import { classifyMoves } from "../../engine/orders";
import { canFight, hasFighter } from "../../engine/units/fighting";
import { validateMoveOrder } from "../../engine/validation";
import { assess, type Assessment } from "../assessment";
import { type AttackContext, type AttackPlan, bestAttackOn } from "../attacks";
import { type Cached, cached, distancesTo, forget, pickBest } from "../choice";
import { bouncedMoves, moveKey, stalledTurns } from "../memory";
import { chooseOffensive, prizeFactor } from "../offensive";
import { createPlan, type Plan } from "../plan";
import { isTransport, isTruck, unitRoutes } from "../reach";
import { createTrains, strongestAboard, type Trains } from "../trains";
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
  const plan = createPlan(assessment, own, (unit) => canFight(scenario, state.raised, unit.id));
  const bounced = bouncedMoves(context.previousOutcomes ?? [], factionId);
  const trains = createTrains(scenario, state);
  const commit = (unit: UnitState, to: TerritoryId, arrives: boolean): void => {
    plan.commit(unit, to, arrives);
    trains.take(unit, to);
  };
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

  garrisonCritical(scenario, assessment, plan, trains, commit, ready, friendly, random);

  const attacks = new Map<TerritoryId, Cached<AttackPlan>>();
  const reinforcements = new Map<UnitId, Cached<Reinforcement>>();
  const attacked = new Set<TerritoryId>();
  for (;;) {
    const options: Decision[] = [];
    for (const territory of scenario.territories) {
      if (attacked.has(territory.id)) continue;
      const scored = cached(attacks, territory.id, () => {
        const candidates = trains.fitting(ready.filter((unit) => plan.isFree(unit) && (destinations.get(unit.id) ?? []).includes(territory.id)), territory.id);
        return {
          best: bestAttackOn(attackContext, territory.id, candidates),
          depends: new Set(candidates.flatMap((unit): string[] => [unit.id, unit.territoryId, trains.boarding(unit, territory.id) ?? unit.territoryId]))
        };
      });
      if (scored.best !== undefined && scored.best.score > 0) options.push({ kind: "attack", ...scored.best });
    }
    for (const unit of ready) {
      if (!plan.isFree(unit)) continue;
      const reached = friendly.get(unit.id) ?? [];
      const scored = cached(reinforcements, unit.id, () => ({
        best: bestReinforcement(plan, unit, reached.filter((to) => trains.fitting([unit], to).length > 0), weights.caution, (to) =>
          Math.max(0, (distance.get(unit.territoryId) ?? 0) - (distance.get(to) ?? 0)) * weights.approachObjective
          + staging(unit, to)
          + moveBias(unit, to), random),
        depends: new Set([unit.id, unit.territoryId, ...reached, ...reached.flatMap((to) => trains.boarding(unit, to) ?? [])])
      }));
      if (scored.best !== undefined && scored.best.score > 0) options.push({ kind: "reinforcement", ...scored.best });
    }

    const chosen = pickBest(options, (option) => option.score, random);
    if (chosen === undefined) break;
    let changed: readonly string[];
    if (chosen.kind === "attack") {
      attacked.add(chosen.target);
      const opened = plan.opensCritical();
      for (const unit of chosen.armies) commit(unit, chosen.target, false);
      // Once one critical territory is open, no other attack may count on opening another.
      if (plan.opensCritical() !== opened) attacks.clear();
      changed = chosen.armies.flatMap((unit): string[] => [unit.id, unit.territoryId, trains.boarding(unit, chosen.target) ?? unit.territoryId]);
    } else {
      commit(chosen.unit, chosen.to, true);
      changed = [chosen.unit.id, chosen.unit.territoryId, chosen.to, trains.boarding(chosen.unit, chosen.to) ?? chosen.to];
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
    if (isTruck(scenario, state, unit.id) || !(unitTypeOf(scenario, state, unit.id)?.orders.includes("move") ?? true)) return [];
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

/**
 * D23: before anything else, an army steps into each own victory-critical territory that stands
 * empty: one a rival can reach this turn and would win by taking (`Assessment.isCritical`), or would
 * win by taking together with another that also stands empty (`Assessment.criticalWith`). Of the
 * armies that can reinforce it without emptying an objective or another critical territory, it
 * sends the one whose move scores best (danger removed there, less danger left at home). The
 * greedy planner may then add more.
 */
function garrisonCritical(
  scenario: Scenario,
  assessment: Assessment,
  plan: Plan,
  trains: Trains,
  commit: Plan["commit"],
  ready: readonly UnitState[],
  friendly: ReadonlyMap<UnitId, readonly TerritoryId[]>,
  random: RandomSource
): void {
  for (const { id } of scenario.territories) {
    if (plan.armiesIn(id) > 0) continue;
    if (!assessment.isCritical(id) && !assessment.criticalWith(id).some((other) => plan.armiesIn(other) === 0)) continue;
    const options = ready.flatMap((unit) => {
      if (!plan.isFree(unit) || !(friendly.get(unit.id) ?? []).includes(id) || trains.fitting([unit], id).length === 0) return [];
      const cost = plan.exposure([unit]);
      return cost === undefined ? [] : [{ score: plan.reinforcementGain(unit, id) - cost, unit }];
    });
    const chosen = pickBest(options, (option) => option.score, random);
    if (chosen !== undefined) commit(chosen.unit, id, true);
  }
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

/**
 * H5 for rail, trucks and sea (M1-M5). The planner chose destinations; this gives each order
 * the route the game offers for its unit, then checks the plan as armies (W4):
 * - free trucks go with the largest army leaving their territory whose route they may take
 *   (R5: not across a link with no road) with a train place left for each (D5), a marching (Motor) one first;
 * - a march its army's trucks cannot carry takes the army's own route there, or is cut to its
 *   first step, into friendly ground;
 * - an army its trains can't take whole sends the strongest of its units that fit (D5);
 * - armies beyond a port's landings or a lane's one assault stay home;
 * - an army with no unit that can fight (D27.1) moves only to reinforce its own side.
 */
export function withRoutes(scenario: Scenario, state: GameState, factionId: FactionId, planned: readonly MoveOrder[]): readonly MoveOrder[] {
  const own = Object.values(state.units).filter((unit) => unit.factionId === factionId);
  const routed = planned.map((order) => {
    const unit = state.units[order.unitId];
    const route = unit === undefined ? undefined : legalMoves(scenario, state, unit).find((move) => move.to === order.to);
    return route ?? order;
  });
  const ordered = new Set(routed.map((order) => order.unitId));
  // A demoralized truck cannot go with an attack (M23), so it rests instead.
  const idle = own.filter((unit) => !ordered.has(unit.id) && !unit.morale.demoralized && isTransport(scenario, state, unit.id));
  const result: MoveOrder[] = [...routed];
  for (const truck of idle.filter((unit) => isTruck(scenario, state, unit.id))) {
    const leaving = armiesOf((order) => armyKey(scenario, order), result.filter((order) => order.from === truck.territoryId));
    // R5: only with an army whose route a truck may take (trucks are not foot: no March across a link without a road).
    const carries = (army: (typeof leaving)[number]): boolean => {
      const [lead] = army.orders;
      return describeRoute(scenario, state, factionId, lead.from, legsOf(scenario, lead), true, undefined, [...army.orders.map((order) => order.unitId), truck.id]).ok
        && boardingRefusal(scenario, state, [{ ...lead, unitId: truck.id }], result) === undefined;
    };
    const marching = leaving.filter((army) => (army.orders[0].legs?.length ?? 1) > 1 && army.orders[0].legs?.every((leg) => leg.kind === "land") === true);
    const target = [...marching, ...leaving].filter(carries).sort((left, right) => right.orders.length - left.orders.length)[0]?.orders[0];
    if (target !== undefined) result.push({ ...target, unitId: truck.id });
  }
  // A fighting transport with no order of its own (a tank) leaves only with an army that cannot make its march without it.
  for (const carrier of idle.filter((unit) => !isTruck(scenario, state, unit.id))) {
    const target = armiesOf((order) => armyKey(scenario, order), result.filter((order) => order.from === carrier.territoryId && (order.legs?.length ?? 1) > 1))
      .find((army) => {
        const { to } = army.orders[0];
        const unitIds = army.orders.map((order) => order.unitId);
        const goes = (ids: readonly UnitId[]): boolean => moveRoutes(scenario, state, factionId, carrier.territoryId, ids).has(to);
        return !goes(unitIds) && goes([...unitIds, carrier.id]);
      })?.orders[0];
    if (target !== undefined) result.push({ ...target, unitId: carrier.id });
  }
  const fitted = result.map((order) => {
    const legs = order.legs ?? [];
    if (legs.length < 2 || !legs.every((leg) => leg.kind === "land")) return order;
    const army = result.filter((other) => armyKey(scenario, other) === armyKey(scenario, order)).map((other) => other.unitId);
    // The whole army's route there, which may be a ride rather than the march one unit could make.
    const route = moveRoutes(scenario, state, factionId, order.from, army).get(order.to);
    if (route !== undefined) {
      const step: MoveOrder = { factionId: order.factionId, from: order.from, kind: "move", to: order.to, unitId: order.unitId };
      return route.shape === "step" ? step : { ...step, legs: route.legs };
    }
    const first = legs[0];
    return first === undefined ? order : { ...order, legs: [first], to: first.to };
  });
  const usable: MoveOrder[] = [];
  const boarded = new Map<SubTerritoryId, number>();
  const counts = { landings: new Map<string, number>(), lanes: new Map<string, number>() };
  for (const army of armiesOf((order) => armyKey(scenario, order), fitted)) {
    const [first] = army.orders;
    // R1, R5: the army's own units, so the foot rule and its pocket are checked.
    const check = describeRoute(scenario, state, factionId, first.from, legsOf(scenario, first), true, undefined, army.orders.map((order) => order.unitId));
    if (!check.ok) continue;
    const claims = routeClaims(check.route);
    const fits = (map: Map<string, number>, key: string | undefined, limit: number): boolean => key === undefined || (map.get(key) ?? 0) < limit;
    if (!fits(counts.landings, claims.landing, portLandings(scenario, check.route.sea?.level ?? 0))
      || !fits(counts.lanes, claims.amphibious, 1)) continue;
    for (const [map, key] of [[counts.landings, claims.landing], [counts.lanes, claims.amphibious]] as const) {
      if (key !== undefined) map.set(key, (map.get(key) ?? 0) + 1);
    }
    if (claims.departure === undefined) {
      usable.push(...army.orders);
      continue;
    }
    const used = boarded.get(claims.departure) ?? 0;
    const units = army.orders.flatMap((order) => state.units[order.unitId] ?? []);
    const aboard = strongestAboard(scenario, state, units, railCapacity(scenario, state, claims.departure) - used);
    boarded.set(claims.departure, used + railPlaces(scenario, state, aboard));
    usable.push(...army.orders.filter((order) => aboard.includes(order.unitId)));
  }
  // D27.1: an army with no unit that can fight only reinforces its own side; one left to advance alone holds instead.
  const advancing = new Set(classifyMoves(scenario, state, state.units, usable).advances.map((order) => order.unitId));
  const fighting = new Set(armiesOf((order) => armyKey(scenario, order), usable)
    .filter((army) => hasFighter(scenario, state.raised, army.orders.map((order) => order.unitId)))
    .flatMap((army) => army.orders.map((order) => order.unitId)));
  return usable.filter((order) => fighting.has(order.unitId) || !advancing.has(order.unitId));
}
