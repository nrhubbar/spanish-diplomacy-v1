import type { Armies } from "../board";
import type { ArmyLoss, BattleArmy, BattleSide, GameState, GradeSideEffect, Morale, Scenario, UnitId, UnitState } from "../types";
import { canFight } from "../units/fighting";
import { definitionOf, isGeneralUnit, unitRank } from "./rules";

/** What one side suffered. */
export interface Casualties {
  readonly demoralized: readonly UnitId[];
  readonly losses: readonly ArmyLoss[];
  /** The side's armies after the effect; destroyed armies are absent. */
  readonly survivors: readonly UnitState[];
}

/** Demoralized with its recovery clock restarted (M23). */
export const freshlyDemoralized: Morale = { demoralized: true, quietTurns: 0 };

/**
 * D2, D6: what one grade does to one side.
 * 1. "Defender broken": the weakest unit (lowest value; ties fewer men, then scenario order) is destroyed.
 * 2. Every other unit loses `lossPercent` of its men now, rounded to the nearest man.
 * 3. A unit left below `breakUpShare` of its full strength breaks up (D6, Q-MR-08).
 * 4. Survivors are demoralized: none, all, or the weakest first until they carry at least half
 *    of the side's value (Q-D20-5, as M16 today), counting combat units first: units that
 *    cannot fight (trucks, anti-air) come last (D27.6).
 * General units (U5) lose no men and are never demoralized; whether a general dies with his
 * army is the generals module's roll. Units already gone (an earlier attack on the same
 * defenders) are skipped, so losses add up across several attacks (M17).
 */
export function applyGradeSide(
  scenario: Scenario,
  state: Pick<GameState, "raised">,
  effect: GradeSideEffect & { readonly weakestDestroyed?: boolean },
  side: BattleSide,
  armies: Armies,
  breakUpShare: number
): Casualties {
  const rank = unitRank(scenario);
  const members = side.armies.flatMap((army): Member[] => {
    const unit = armies[army.unitId];
    return unit === undefined ? [] : [{ army, general: isGeneralUnit(scenario, state.raised, unit.id), unit }];
  });
  const fighting = members.filter((member) => !member.general);
  const weakestFirst = [...fighting].sort((left, right) =>
    left.army.value - right.army.value || left.unit.strength - right.unit.strength || rank(left.unit.id) - rank(right.unit.id));
  const losses: ArmyLoss[] = [];
  const after = new Map<UnitId, UnitState>(members.map((member) => [member.unit.id, member.unit]));
  const destroy = (unit: UnitState): void => {
    losses.push({ destroyed: true, men: unit.strength, unitId: unit.id });
    after.delete(unit.id);
  };
  const broken = effect.weakestDestroyed === true ? weakestFirst[0] : undefined;
  if (broken !== undefined) destroy(broken.unit);
  for (const { unit } of fighting) {
    if (unit === broken?.unit) continue;
    const men = Math.min(unit.strength, Math.round((unit.strength * effect.lossPercent) / 100));
    const left = unit.strength - men;
    if (left <= 0 || left < breakUpShare * definitionOf(scenario, state.raised, unit.id).fullStrength) {
      destroy(unit);
    } else if (men > 0) {
      losses.push({ destroyed: false, men, unitId: unit.id });
      after.set(unit.id, { ...unit, strength: left });
    }
  }
  // D27.6: demoralization takes combat units weakest first; units that cannot fight (trucks, anti-air) come last.
  const fights = (member: Member): boolean => canFight(scenario, state.raised, member.unit.id);
  const standing = weakestFirst.filter((member) => after.has(member.unit.id));
  const demoralized = demoralizedIds(effect, side.value, [...standing.filter(fights), ...standing.filter((member) => !fights(member))]);
  for (const id of demoralized) {
    const unit = after.get(id);
    if (unit !== undefined) after.set(id, { ...unit, morale: freshlyDemoralized });
  }
  return {
    demoralized,
    losses: [...losses].sort((left, right) => rank(left.unitId) - rank(right.unitId) || (left.unitId < right.unitId ? -1 : 1)),
    survivors: members.flatMap((member) => after.get(member.unit.id) ?? [])
  };
}

interface Member {
  readonly army: BattleArmy;
  readonly general: boolean;
  readonly unit: UnitState;
}

function demoralizedIds(effect: GradeSideEffect, sideValue: number, weakestFirst: readonly Member[]): readonly UnitId[] {
  switch (effect.demoralized) {
    case "none":
      return [];
    case "all":
      return weakestFirst.map((member) => member.unit.id);
    case "half": {
      const ids: UnitId[] = [];
      let carried = 0;
      for (const { army } of weakestFirst) {
        if (carried * 2 >= sideValue) break;
        ids.push(army.unitId);
        carried += army.value;
      }
      return ids;
    }
  }
}

/** Units still able to fight: survivors other than generals. */
export function fightingSurvivors(scenario: Scenario, state: Pick<GameState, "raised">, casualties: Casualties): readonly UnitState[] {
  return casualties.survivors.filter((unit) => !isGeneralUnit(scenario, state.raised, unit.id));
}
