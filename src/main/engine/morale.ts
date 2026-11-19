import { freshlyDemoralized } from "./battleResults";
import { type Armies, replaceArmies, unitOrder } from "./board";
import type { RecoveredOutcome, Scenario, UnitId } from "./types";

export interface MoraleResolution {
  readonly armies: Armies;
  readonly recovered: readonly RecoveredOutcome[];
}

/**
 * M23 (C6), at the end of the turn: a demoralized army rested when it had no move order (its
 * standing order is Rest, O2), did not retreat, and was not demoralized this turn (`unquiet`
 * lists every army that did not rest). One turn of rest is enough: the army recovers and is
 * reported as recovered. Any other turn restarts its count, so `quietTurns` is 0 whenever an
 * army is demoralized. Outcomes are in scenario order.
 */
export function recoverMorale(scenario: Scenario, armies: Armies, unquiet: ReadonlySet<UnitId>): MoraleResolution {
  const order = unitOrder(scenario);
  const demoralized = Object.values(armies)
    .filter((unit) => unit.morale.demoralized)
    .sort((left, right) => order(left.id) - order(right.id));
  const recovering = demoralized.filter((unit) => !unquiet.has(unit.id));
  return {
    armies: replaceArmies(armies, demoralized.map((unit) => ({
      ...unit,
      morale: unquiet.has(unit.id) ? freshlyDemoralized : { demoralized: false, quietTurns: 0 }
    }))),
    recovered: recovering.map((unit) => ({ factionId: unit.factionId, kind: "recovered", territoryId: unit.territoryId, unitId: unit.id }))
  };
}
