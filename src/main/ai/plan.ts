import type { MoveOrder, TerritoryId, UnitId, UnitState } from "../engine/types";
import type { Assessment } from "./assessment";

/**
 * A computer player's orders as they take shape, and what they leave behind: the own
 * defence standing in each territory once the planned armies have left or arrived.
 */
export interface Plan {
  /** Plans an army's move. `arrives` is true for a reinforcement, which joins the destination's defence (M11). */
  readonly commit: (unit: UnitState, to: TerritoryId, arrives: boolean) => void;
  /** How many own armies the plan leaves standing in a territory. */
  readonly armiesIn: (territoryId: TerritoryId) => number;
  /**
   * What sending these armies away costs: for each origin, its stake times the rise in its
   * danger. Undefined when they would leave an objective, or a victory-critical territory
   * (D23), with none of the own armies standing there now. Planned arrivals do not count for
   * this: a move in can still fail (a bounce, a battle on the way, a full railhead), so the last
   * army on the ground never leaves it. A critical territory may be left empty only to attack
   * `target` when every hostile army that threatens it stands there: the attack meets that threat.
   */
  readonly exposure: (departures: readonly UnitState[], target?: TerritoryId) => number | undefined;
  /** What one more army in a territory is worth: its stake times the fall in its danger. */
  readonly reinforcementGain: (unit: UnitState, territoryId: TerritoryId) => number;
  /** Whether the army still has no order. */
  readonly isFree: (unit: UnitState) => boolean;
  readonly orders: () => readonly MoveOrder[];
}

export function createPlan(assessment: Assessment, own: readonly UnitState[]): Plan {
  const defence = new Map<TerritoryId, number>();
  const count = new Map<TerritoryId, number>();
  // Own armies standing in each territory now and still without an order.
  const staying = new Map<TerritoryId, number>();
  const ordered = new Set<UnitId>();
  const orders: MoveOrder[] = [];
  for (const unit of own) {
    add(defence, unit.territoryId, assessment.defenceOf(unit));
    add(count, unit.territoryId, 1);
    add(staying, unit.territoryId, 1);
  }

  const exposure = (departures: readonly UnitState[], target?: TerritoryId): number | undefined => {
    const leaving = new Map<TerritoryId, { readonly armies: number; readonly value: number }>();
    for (const unit of departures) {
      const before = leaving.get(unit.territoryId) ?? { armies: 0, value: 0 };
      leaving.set(unit.territoryId, { armies: before.armies + 1, value: before.value + assessment.defenceOf(unit) });
    }
    let cost = 0;
    for (const [origin, { armies, value }] of leaving) {
      const remaining = (staying.get(origin) ?? 0) - armies;
      if (remaining <= 0 && assessment.isObjective(origin)) return undefined;
      // D23: critical ground is never emptied, except by an attack on the one place its threat
      // stands, which meets the threat.
      if (remaining <= 0 && assessment.isCritical(origin) && !onlyThreatFrom(origin, target)) return undefined;
      const standing = defence.get(origin) ?? 0;
      cost += assessment.stake(origin) * (assessment.danger(origin, standing - value) - assessment.danger(origin, standing));
    }
    return cost;
  };

  const onlyThreatFrom = (origin: TerritoryId, target: TerritoryId | undefined): boolean =>
    target !== undefined && [...assessment.threatOrigins(origin)].every((territoryId) => territoryId === target);

  const reinforcementGain = (unit: UnitState, territoryId: TerritoryId): number => {
    const standing = defence.get(territoryId) ?? 0;
    const after = standing + assessment.defenceOf(unit);
    return assessment.stake(territoryId) * (assessment.danger(territoryId, standing) - assessment.danger(territoryId, after));
  };

  const commit = (unit: UnitState, to: TerritoryId, arrives: boolean): void => {
    ordered.add(unit.id);
    orders.push({ factionId: unit.factionId, from: unit.territoryId, kind: "move", to, unitId: unit.id });
    add(defence, unit.territoryId, -assessment.defenceOf(unit));
    add(count, unit.territoryId, -1);
    add(staying, unit.territoryId, -1);
    if (arrives) {
      add(defence, to, assessment.defenceOf(unit));
      add(count, to, 1);
    }
  };

  return {
    armiesIn: (territoryId) => count.get(territoryId) ?? 0,
    commit,
    exposure,
    isFree: (unit) => !ordered.has(unit.id),
    orders: () => orders,
    reinforcementGain
  };
}

function add(map: Map<TerritoryId, number>, key: TerritoryId, amount: number): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}
