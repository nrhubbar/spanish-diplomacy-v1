import { hookedCombatModifiers } from "../hooks";
import { worksRoll } from "../works";
import { citiesIn } from "../lookup";
import type { MoveRoute } from "../movement/routes";
import type { TurnScratch } from "../phases/draft";
import type { BattleSide, CombatModifier, CombatRole, D20Rules, FactionId, GameState, Scenario, TerritoryId, UnitId, UnitState, UnitTypeId, WeatherState } from "../types";
import { bestGeneral, commanderModifiers } from "../generals/command";
import { definitionOf, fightingValue, isGeneralUnit, typeOf, weatherIn } from "./rules";

/** One side as it fights: its values, and its units' states (for fatigue and generals). */
export interface FightingSide {
  readonly role: CombatRole;
  readonly side: BattleSide;
  readonly units: readonly UnitState[];
}

/** Where and how a d20 battle is fought, for the modifiers that depend on the situation. */
export interface ModifierContext {
  readonly attackerFactionId: FactionId;
  /** R11: the battle's index while the turn resolves, for its air battle's rolls. */
  readonly battleIndex?: number;
  readonly defenderFactionIds: readonly FactionId[];
  /** Whether the territory's works count (M22): assaults only. */
  readonly diggingIn: boolean;
  /** A planning estimate's attackers whose way there is already chosen, passed on to the hooks. */
  readonly plannedRoutes?: ReadonlyMap<UnitId, MoveRoute>;
  /**
   * The battle territory. Absent for a head-on meeting on the road (M20), which takes only the
   * armies' own modifiers (generals, unit bonuses and fatigue) and the weather (D27.5).
   */
  readonly territoryId?: TerritoryId;
  /** The turn's scratch while a turn resolves, passed on to the hooks (bomber support, m3r1-air-generals). */
  readonly scratch?: TurnScratch;
  /** Whose weather the unit bonuses read (D5: tanks); the battle territory, or a meeting's destination. */
  readonly weatherTerritoryId?: TerritoryId;
}

/**
 * D3-D7, C6: every roll modifier of one d20 battle, signed from the attacker's view.
 * - Situational (not on the road): works, 2 a pip (M22, R8), faction modifiers such as Popular
 *   resistance from the d20 block (M24, D3), barricades (D4), and the selected modules'
 *   `combatModifiers` hooks: weather, amphibious, air support, buildings (D7). A meeting on the
 *   road takes the hooks' weather only, from its attackers' destination (D27.5).
 * - The armies' own, always: the best general per side and his trait (D4, U6, declog D5),
 *   unit-type bonuses such as artillery and tanks (D5), and fatigue (C6, declog D6).
 */
export function battleModifiers(
  scenario: Scenario,
  state: GameState,
  weather: WeatherState | undefined,
  context: ModifierContext,
  attacker: FightingSide,
  defender: FightingSide
): readonly CombatModifier[] {
  const rules = scenario.d20;
  const { territoryId } = context;
  const situational: CombatModifier[] = [];
  if (territoryId !== undefined) {
    const works = state.fortification[territoryId];
    if (context.diggingIn && works !== undefined && works.level > 0 && context.defenderFactionIds.includes(works.factionId)) {
      situational.push({ kind: "dug-in", level: works.level, roll: -worksRoll(scenario, works.level) });
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
  // D27.5: a meeting on the road takes only the weather of its attackers' destination from the hooks.
  const hookTerritoryId = territoryId ?? context.weatherTerritoryId;
  const hooks = hookTerritoryId === undefined ? [] : hookedCombatModifiers({
    attackerFactionId: context.attackerFactionId,
    attackerUnitIds: attacker.units.map((unit) => unit.id),
    ...(context.battleIndex === undefined ? {} : { battleIndex: context.battleIndex }),
    defenderFactionIds: context.defenderFactionIds,
    defenderUnitIds: defender.units.map((unit) => unit.id),
    diggingIn: context.diggingIn,
    ...(context.plannedRoutes === undefined ? {} : { plannedRoutes: context.plannedRoutes }),
    ...(context.scratch === undefined ? {} : { scratch: context.scratch }),
    scenario,
    state,
    territoryId: hookTerritoryId
  });
  const hooked = territoryId === undefined ? hooks.filter((modifier) => modifier.kind === "weather") : hooks;
  return [...situational, ...own, ...hooked];
}

/** M24, D4: the territory holds a city the faction controlled at the start of the turn. */
function holdsCity(scenario: Scenario, state: GameState, factionId: FactionId, territoryId: TerritoryId): boolean {
  return citiesIn(scenario, territoryId).some((city) => state.cityControl[city.id] === factionId);
}

const sign = (role: CombatRole): number => (role === "attack" ? 1 : -1);

/**
 * D4, U6 (declog D5): only the best single general on a side counts, chosen by the selector the
 * rally uses too (`bestGeneral`, M5): the greatest command bonus plus his trait's roll for the
 * side's role, then roster order. His trait applies with him.
 */
function generalModifiers(scenario: Scenario, state: GameState, side: FightingSide): readonly CombatModifier[] {
  const best = bestGeneral(scenario, state.raised, side.units.map((unit) => unit.id), side.role);
  return commanderModifiers(best, best === undefined ? undefined : side.units.find((unit) => unit.id === best.unitId)?.factionId, side.role);
}

/**
 * D5: each unit type with a per-points bonus for the side's role: +bonus per `per` points of
 * that type's value on the side, at most `max`, none in the listed weather. Counted per side.
 */
function unitBonuses(scenario: Scenario, state: GameState, side: FightingSide, weatherId: string | undefined): readonly CombatModifier[] {
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
function fatigueModifier(rules: D20Rules, side: FightingSide): readonly CombatModifier[] {
  if (rules.modifiers.fatigued === 0 || side.side.value <= 0) return [];
  const fatigued = new Set(side.units.filter((unit) => unit.fatigue >= rules.fatigue.fatiguedLevel).map((unit) => unit.id));
  const carried = side.side.armies.reduce((sum, army) => sum + (fatigued.has(army.unitId) ? army.value : 0), 0);
  const [first] = side.units;
  if (first === undefined || carried * 2 < side.side.value) return [];
  return [{ factionId: first.factionId, kind: "fatigue", role: side.role, roll: sign(side.role) * rules.modifiers.fatigued }];
}

/** M12 on the d20: one side's values, each unit fighting from where it came. Generals count 0. */
export function fightingSide(scenario: Scenario, state: Pick<GameState, "raised">, combatants: readonly { readonly from: TerritoryId; readonly unit: UnitState }[], role: CombatRole): BattleSide {
  const armies = combatants.map(({ from, unit }) => ({
    demoralized: unit.morale.demoralized,
    factionId: unit.factionId,
    from,
    fullMen: definitionOf(scenario, state.raised, unit.id).fullStrength,
    men: unit.strength,
    unitId: unit.id,
    value: isGeneralUnit(scenario, state.raised, unit.id) ? 0 : fightingValue(scenario, state.raised, unit, role)
  }));
  return { armies, value: armies.reduce((sum, army) => sum + army.value, 0) };
}
