import { territoriesWithin } from "../engine/air/pieces";
import { lastColumn } from "../engine/combat/values";
import { gradeAt, scoreFor } from "../engine/d20/odds";
import { d20Faces, fightingValue } from "../engine/d20/rules";
import { requireAiProfile } from "../engine/lookup";
import { unitBasics } from "../engine/recruitment/rules";
import type { D20Rules, FactionId, GameState, RecruitOrder, ResourceId, Resources, Scenario, TerritoryId, UnitTypeDefinition } from "../engine/types";
import { canFight } from "../engine/units/fighting";

/**
 * D6: what a recruit is worth to the computer player: its own values, and what its roll bonuses
 * (guns, tanks, aircraft on Ground Support) add to a battle near the site, in points of attack.
 */

/** Design note for the harness to tune (H7): each turn of training lowers a type's worth a little, so a threatened front prefers quicker units. */
const trainingDrag = 0.15;

/** How good a column of the table is for the attacker at a roll modifier: its chance of any ground plus its chance of it all. */
function columnValue(rules: D20Rules, column: number, modifier: number): number {
  return d20Faces.reduce((sum, die) => {
    const { ground } = gradeAt(rules, column, scoreFor(die, modifier));
    return sum + (ground === "all" ? 2 : ground === 0 ? 0 : 1);
  }, 0);
}

/** The share of an odds column that one point on the roll is worth, over the scenario's whole table. */
export function columnsPerRoll(rules: D20Rules): number {
  let columns = 0;
  let rolls = 0;
  for (let column = 0; column < lastColumn; column += 1) {
    const plain = columnValue(rules, column, 0);
    columns += columnValue(rules, column + 1, 0) - plain;
    rolls += columnValue(rules, column, 1) - plain;
  }
  return columns <= 0 ? 0 : rolls / columns;
}

/** The roll points one more unit of the type adds to a side that has `count` of them, up to each effect's most. */
export function nextRollBonus(scenario: Scenario, type: UnitTypeDefinition, count: number): number {
  return type.effects.reduce((sum, effect) => {
    if (effect.kind === "battle-support") return sum + (count < (scenario.air?.supportMax ?? Number.POSITIVE_INFINITY) ? effect.roll : 0);
    if (effect.kind !== "roll-bonus-per-points") return sum;
    const bonus = (units: number): number => Math.min(effect.max, Math.floor((units * type[effect.role]) / effect.per) * effect.bonus);
    return sum + bonus(count + 1) - bonus(count);
  }, 0);
}

/** What the battles a recruit site feeds look like, for judging roll bonuses there. */
export interface SiteBattles {
  /** The own units of a type near enough to fight together, in training and ordered this turn included. */
  readonly count: (type: UnitTypeDefinition) => number;
  /** A roll point in points of attack. An odds column costs the defence's value again, or, for a weaker side, its own. */
  readonly rollPoint: number;
}

/**
 * The battles near a site: the faction's own attack there and next door against the strongest
 * stack other factions have within the profile's offensive reach. Only units that can fight count.
 */
export function siteBattles(scenario: Scenario, state: GameState, factionId: FactionId, site: TerritoryId, ordered: readonly RecruitOrder[], perRoll: number): SiteBattles {
  const near = territoriesWithin(scenario, site, 1);
  const faced = territoriesWithin(scenario, site, requireAiProfile(scenario, factionId).offensive.reach);
  const stacks = new Map<TerritoryId, number>();
  let attack = 0;
  for (const unit of Object.values(state.units)) {
    if (!canFight(scenario, state.raised, unit.id)) continue;
    if (unit.factionId === factionId) attack += near.has(unit.territoryId) ? fightingValue(scenario, state.raised, unit, "attack") : 0;
    else if (faced.has(unit.territoryId)) stacks.set(unit.territoryId, (stacks.get(unit.territoryId) ?? 0) + fightingValue(scenario, state.raised, unit, "defence"));
  }
  const count = (type: UnitTypeDefinition): number => {
    const reach = type.air === undefined ? near : territoriesWithin(scenario, site, type.air.range);
    return Object.values(state.units).filter((unit) => unit.factionId === factionId && reach.has(unit.territoryId) && unitBasics(scenario, state, unit.id)?.type.id === type.id).length
      + state.training.filter((item) => item.factionId === factionId && item.typeId === type.id && reach.has(item.territoryId)).length
      + ordered.filter((order) => order.unitTypeId === type.id && reach.has(order.territoryId)).length;
  };
  return { count, rollPoint: Math.min(attack, Math.max(0, ...stacks.values())) * perRoll };
}

/** Combat value per price, roll bonuses included, each resource counted as a share of the balance, lowered for long training. */
export function worthOf(scenario: Scenario, type: UnitTypeDefinition, balance: Resources, battles: SiteBattles): number {
  const recruit = type.recruit;
  if (recruit === undefined) return 0;
  const price = (Object.entries(recruit.cost) as [ResourceId, number][]).reduce((sum, [id, amount]) => sum + amount / Math.max(1, balance[id] ?? 0), 0);
  const bonus = nextRollBonus(scenario, type, battles.count(type)) * battles.rollPoint;
  return (type.attack + type.defence + bonus) / Math.max(0.01, price) / (1 + trainingDrag * recruit.trainingTurns);
}
