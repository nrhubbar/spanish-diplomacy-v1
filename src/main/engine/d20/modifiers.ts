import { hookedCombatModifiers } from "../hooks";
import { citiesIn } from "../lookup";
import type { TurnScratch } from "../phases/draft";
import type { BattleSide, CombatModifier, CombatRole, D20Rules, FactionId, GameState, Scenario, TerritoryId, UnitState, UnitTypeId, WeatherState } from "../types";
import { compareText, gradedValue, isGeneralUnit, requireD20, rosterGeneral, typeOf, unitRank, weatherIn } from "./rules";

/** One side as it fights: its values, and its units' states (for fatigue and generals). */
export interface GradedSide {
  readonly role: CombatRole;
  readonly side: BattleSide;
  readonly units: readonly UnitState[];
}

/** Where and how a d20 battle is fought, for the modifiers that depend on the situation. */
export interface GradedContext {
  readonly attackerFactionId: FactionId;
  readonly defenderFactionIds: readonly FactionId[];
  /** Whether the territory's works count (M22): assaults only. */
  readonly diggingIn: boolean;
  /**
   * The battle territory. Absent for a head-on meeting on the road (M20), which takes only the
   * armies' own modifiers: generals, unit bonuses and fatigue.
   */
  readonly territoryId?: TerritoryId;
  /** The turn's scratch while a turn resolves, passed on to the hooks (bomber support, m3r1-air-generals). */
  readonly scratch?: TurnScratch;
  /** Whose weather the unit bonuses read (D5: tanks); the battle territory, or a meeting's destination. */
  readonly weatherTerritoryId?: TerritoryId;
}

/**
 * D3-D7, C6: every roll modifier of one d20 battle, signed from the attacker's view.
 * - Situational (not on the road): works x3 (M22, D3), faction modifiers such as Popular
 *   resistance from the d20 block (M24, D3), barricades (D4), and the selected modules'
 *   `combatModifiers` hooks: weather, amphibious, air support, buildings (D7).
 * - The armies' own, always: the best general per side and his trait (D4, U6, declog D5),
 *   unit-type bonuses such as artillery and tanks (D5), and fatigue (C6, declog D6).
 */
export function gradedModifiers(
  scenario: Scenario,
  state: GameState,
  weather: WeatherState | undefined,
  context: GradedContext,
  attacker: GradedSide,
  defender: GradedSide
): readonly CombatModifier[] {
  const rules = requireD20(scenario);
  const { territoryId } = context;
  const situational: CombatModifier[] = [];
  if (territoryId !== undefined) {
    const works = state.fortification[territoryId];
    if (context.diggingIn && works !== undefined && works.level > 0 && context.defenderFactionIds.includes(works.factionId)) {
      situational.push({ kind: "dug-in", level: works.level, roll: -works.level });
    }
    for (const modifier of rules.factionModifiers) {
      if (!holdsCity(scenario, state, modifier.factionId, territoryId)) continue;
      if (modifier.attack > 0 && modifier.factionId === context.attackerFactionId) {
        situational.push({ factionId: modifier.factionId, kind: "faction", modifierId: modifier.id, name: modifier.name, role: "attack", roll: modifier.attack });
      }
      if (modifier.defence > 0 && context.defenderFactionIds.includes(modifier.factionId)) {
        situational.push({ factionId: modifier.factionId, kind: "faction", modifierId: modifier.id, name: modifier.name, role: "defence", roll: -modifier.defence });
      }
    }
    if (rules.modifiers.barricades > 0 && context.defenderFactionIds.some((factionId) => holdsCity(scenario, state, factionId, territoryId))) {
      situational.push({ kind: "barricades", roll: -rules.modifiers.barricades });
    }
  }
  const weatherId = weatherIn(scenario, weather, context.weatherTerritoryId ?? territoryId);
  const own = [
    ...generalModifiers(scenario, state, attacker),
    ...generalModifiers(scenario, state, defender),
    ...unitBonuses(scenario, state, attacker, weatherId),
    ...unitBonuses(scenario, state, defender, weatherId),
    ...fatigueModifier(rules, attacker),
    ...fatigueModifier(rules, defender)
  ];
  const hooked = territoryId === undefined ? [] : hookedCombatModifiers({
    attackerFactionId: context.attackerFactionId,
    attackerUnitIds: attacker.units.map((unit) => unit.id),
    defenderFactionIds: context.defenderFactionIds,
    diggingIn: context.diggingIn,
    ...(context.scratch === undefined ? {} : { scratch: context.scratch }),
    scenario,
    state,
    territoryId
  });
  return [...situational, ...own, ...hooked];
}

/** M24, D4: the territory holds a city the faction controlled at the start of the turn. */
function holdsCity(scenario: Scenario, state: GameState, factionId: FactionId, territoryId: TerritoryId): boolean {
  return citiesIn(scenario, territoryId).some((city) => state.cityControl[city.id] === factionId);
}

const sign = (role: CombatRole): number => (role === "attack" ? 1 : -1);

/**
 * D4, U6 (declog D5): only the best single general on a side counts: the greatest command bonus
 * plus his trait's roll for the side's role, ties in scenario order. His trait applies with him.
 */
function generalModifiers(scenario: Scenario, state: GameState, side: GradedSide): readonly CombatModifier[] {
  const rank = unitRank(scenario);
  const candidates = side.units.flatMap((unit) => {
    const type = typeOf(scenario, state.raised, unit.id);
    const bonus = type.effects.reduce((sum, effect) => sum + (effect.kind === "command-bonus" ? effect.roll : 0), 0);
    const general = rosterGeneral(scenario, state.raised, unit.id);
    if (general === undefined || bonus === 0) return [];
    const trait = scenario.generalTraits.find((candidate) => candidate.id === general.traitId);
    const traitRoll = (trait?.effects ?? []).reduce((sum, effect) => sum + (effect.kind === "roll-modifier" && effect.role === side.role ? effect.roll : 0), 0);
    return [{ bonus, general, rank: rank(unit.id), traitRoll, unit }];
  }).sort((left, right) => (right.bonus + right.traitRoll) - (left.bonus + left.traitRoll) || left.rank - right.rank || compareText(left.unit.id, right.unit.id));
  const best = candidates[0];
  if (best === undefined) return [];
  const modifiers: CombatModifier[] = [{ factionId: best.unit.factionId, generalId: best.general.id, kind: "general", role: side.role, roll: sign(side.role) * best.bonus }];
  if (best.traitRoll !== 0) {
    modifiers.push({ generalId: best.general.id, kind: "trait", role: side.role, roll: sign(side.role) * best.traitRoll, traitId: best.general.traitId });
  }
  return modifiers;
}

/**
 * D5: each unit type with a per-points bonus for the side's role: +bonus per `per` points of
 * that type's value on the side, at most `max`, none in the listed weather. Counted per side.
 */
function unitBonuses(scenario: Scenario, state: GameState, side: GradedSide, weatherId: string | undefined): readonly CombatModifier[] {
  const points = new Map<UnitTypeId, number>();
  for (const army of side.side.armies) {
    const type = typeOf(scenario, state.raised, army.unitId);
    points.set(type.id, (points.get(type.id) ?? 0) + army.value);
  }
  return [...points].flatMap(([unitTypeId, total]): CombatModifier[] => {
    const type = scenario.index.unitTypes.get(unitTypeId);
    return (type?.effects ?? []).flatMap((effect): CombatModifier[] => {
      if (effect.kind !== "roll-bonus-per-points" || effect.role !== side.role) return [];
      if (weatherId !== undefined && effect.exceptWeather.some((id) => id === weatherId)) return [];
      const bonus = Math.min(effect.max, Math.floor(total / effect.per) * effect.bonus);
      return bonus > 0 ? [{ kind: "unit-bonus", points: total, role: side.role, roll: sign(side.role) * bonus, unitTypeId }] : [];
    });
  });
}

/** C6, declog D6: a side is Fatigued when its fatigued units carry at least half of its value. */
function fatigueModifier(rules: D20Rules, side: GradedSide): readonly CombatModifier[] {
  if (rules.modifiers.fatigued === 0 || side.side.value <= 0) return [];
  const fatigued = new Set(side.units.filter((unit) => unit.fatigue >= rules.fatigue.fatiguedLevel).map((unit) => unit.id));
  const carried = side.side.armies.reduce((sum, army) => sum + (fatigued.has(army.unitId) ? army.value : 0), 0);
  const [first] = side.units;
  if (first === undefined || carried * 2 < side.side.value) return [];
  return [{ factionId: first.factionId, kind: "fatigue", role: side.role, roll: sign(side.role) * rules.modifiers.fatigued }];
}

/** M12 on the d20: one side's values, each unit fighting from where it came. Generals count 0. */
export function gradedSide(scenario: Scenario, state: Pick<GameState, "raised">, combatants: readonly { readonly from: TerritoryId; readonly unit: UnitState }[], role: CombatRole): BattleSide {
  const armies = combatants.map(({ from, unit }) => ({
    factionId: unit.factionId,
    from,
    unitId: unit.id,
    value: isGeneralUnit(scenario, state.raised, unit.id) ? 0 : gradedValue(scenario, state.raised, unit, role)
  }));
  return { armies, value: armies.reduce((sum, army) => sum + army.value, 0) };
}
