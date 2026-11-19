import { armyValue } from "../engine/combat";
import { requireFaction, requireUnitDefinition, requireUnitType } from "../engine/lookup";
import type { GameState, Scenario, UnitState } from "../engine/types";

/**
 * What a counter or an army row shows: the values that fight now (C5), the type's full values,
 * the men, morale, and the works the army defends behind. Everything here is read from the
 * engine; nothing is recomputed differently for display.
 */
export interface ArmyFigures {
  readonly attack: number;
  readonly defence: number;
  readonly demoralized: boolean;
  /** Dug-in level of the territory's works when they belong to this army's faction. */
  readonly dugIn?: number;
  readonly fullAttack: number;
  readonly fullDefence: number;
  readonly fullStrength: number;
  /** True when the current values differ from the type's full values. */
  readonly reduced: boolean;
  readonly strength: number;
}

export function armyFigures(scenario: Scenario, state: GameState, unit: UnitState): ArmyFigures {
  const definition = requireUnitDefinition(scenario, unit.id);
  const type = requireUnitType(scenario, definition.type);
  const attack = armyValue(scenario, unit, "attack");
  const defence = armyValue(scenario, unit, "defence");
  const works = state.fortification[unit.territoryId];
  const dugIn = works !== undefined && works.factionId === unit.factionId && works.level > 0 ? works.level : undefined;
  return {
    attack,
    defence,
    demoralized: unit.morale.demoralized,
    ...(dugIn === undefined ? {} : { dugIn }),
    fullAttack: type.attack,
    fullDefence: type.defence,
    fullStrength: definition.fullStrength,
    reduced: attack !== type.attack || defence !== type.defence,
    strength: unit.strength
  };
}

/** Attack and defence as wargames print them: "4-6". */
export function valuesLabel(attack: number, defence: number): string {
  return `${String(attack)}-${String(defence)}`;
}

/** Men now over men at full strength: "370/740". */
export function menLabel(figures: Pick<ArmyFigures, "fullStrength" | "strength">): string {
  return `${String(figures.strength)}/${String(figures.fullStrength)}`;
}

/** Share of full strength, 0 to 1, for strength bars. */
export function strengthShare(figures: Pick<ArmyFigures, "fullStrength" | "strength">): number {
  return Math.min(1, Math.max(0, figures.strength / figures.fullStrength));
}

export function dugInLabel(level: number): string {
  return `Dug in +${String(level)}`;
}

/** The figures in words, for accessible names: "attack 2, defence 3 (full 4-6), 370 of 740 men". */
export function figuresDescription(figures: ArmyFigures): string {
  const full = figures.reduced ? ` (full ${valuesLabel(figures.fullAttack, figures.fullDefence)})` : "";
  return [
    `attack ${String(figures.attack)}, defence ${String(figures.defence)}${full}`,
    `${String(figures.strength)} of ${String(figures.fullStrength)} men`,
    ...(figures.demoralized ? ["demoralized, cannot attack"] : []),
    ...(figures.dugIn === undefined ? [] : [dugInLabel(figures.dugIn).toLowerCase()])
  ].join(", ");
}

/** A counter's accessible name: the army, its faction, its figures, and whether it has an order. */
export function counterLabel(scenario: Scenario, figures: ArmyFigures, unit: UnitState, ordered: boolean): string {
  return [
    requireUnitDefinition(scenario, unit.id).name,
    requireFaction(scenario, unit.factionId).name,
    figuresDescription(figures),
    ...(ordered ? ["order planned"] : [])
  ].join(", ");
}

/** Why a demoralized army may not attack, in the player's terms (C6, M23). */
export function demoralizedRule(scenario: Scenario): string {
  const factor = scenario.combat.demoralizationFactor;
  const values = factor === 0.5 ? "half their values" : `${String(Math.round(factor * 100))} percent of their values`;
  return `Demoralized armies fight at ${values} and cannot attack. They may move only into empty or friendly territory, and recover after a full turn without moving.`;
}

/**
 * Several armies of one faction in one territory, as one compact counter: their values and men
 * summed (a side's value is the sum of its armies' rounded values, M12), how many are
 * demoralized, and the works they share.
 */
export interface GroupFigures extends ArmyFigures {
  readonly count: number;
  readonly demoralizedCount: number;
}

export function groupFigures(scenario: Scenario, state: GameState, units: readonly UnitState[]): GroupFigures {
  const each = units.map((unit) => armyFigures(scenario, state, unit));
  const sum = (pick: (figures: ArmyFigures) => number) => each.reduce((total, figures) => total + pick(figures), 0);
  const attack = sum((figures) => figures.attack);
  const defence = sum((figures) => figures.defence);
  const fullAttack = sum((figures) => figures.fullAttack);
  const fullDefence = sum((figures) => figures.fullDefence);
  const demoralizedCount = each.filter((figures) => figures.demoralized).length;
  const dugIn = each.find((figures) => figures.dugIn !== undefined)?.dugIn;
  return {
    attack,
    count: each.length,
    defence,
    demoralized: demoralizedCount > 0,
    demoralizedCount,
    ...(dugIn === undefined ? {} : { dugIn }),
    fullAttack,
    fullDefence,
    fullStrength: sum((figures) => figures.fullStrength),
    reduced: attack !== fullAttack || defence !== fullDefence,
    strength: sum((figures) => figures.strength)
  };
}

/** A compact counter's accessible name: whose armies, how many, where, and their totals. */
export function groupLabel(factionName: string, territoryName: string, figures: GroupFigures): string {
  return [
    `${factionName}, ${String(figures.count)} armies in ${territoryName}`,
    `combined attack ${String(figures.attack)}, defence ${String(figures.defence)}`,
    `${String(figures.strength)} of ${String(figures.fullStrength)} men`,
    ...(figures.demoralizedCount > 0 ? [`${String(figures.demoralizedCount)} demoralized`] : []),
    ...(figures.dugIn === undefined ? [] : [dugInLabel(figures.dugIn).toLowerCase()])
  ].join(", ");
}
