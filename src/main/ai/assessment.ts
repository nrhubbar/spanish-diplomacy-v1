import { armyValue, battleOdds, situationalModifiers } from "../engine/combat";
import { citiesIn, neighborsOf, requireFaction, requireTerritory } from "../engine/lookup";
import type { FactionId, GameState, Scenario, TerritoryId, UnitId, UnitState } from "../engine/types";
import { victoryProgress } from "../engine/victory";

/** What each part of a territory is worth to a computer player. */
export const stakeWeights = {
  /** Each city that counts for victory. */
  city: 2,
  /** A territory the faction's objectives name. */
  objective: 5,
  /** A territory that counts for victory. */
  territory: 4
} as const;

/**
 * Victory alarm: when a rival is within `steps` territories of winning, territories the
 * faction holds, and those the rival holds, are worth `perStep` more of their stake for each
 * step closer. Holding the line and taking ground back then outweigh lesser gains.
 */
export const victoryAlarm = { perStep: 0.5, steps: 4 } as const;

/**
 * A computer player's reading of the board at the start of a turn, from one faction's point
 * of view. It uses only public information (positions, men, morale, works) and the engine's
 * own battle maths, so it judges odds exactly as the battle rules will. Every answer is
 * cached, because planning asks the same questions many times.
 */
export interface Assessment {
  readonly factionId: FactionId;
  /** The army's attack value (M12) at the start of the turn. */
  readonly attackOf: (unit: UnitState) => number;
  /**
   * The chance that the strongest hostile faction around a territory takes it from own
   * armies worth `defence` there, if every hostile army next to it attacked (or, at zero
   * defence, simply walked in). Zero when no hostile army can reach it.
   */
  readonly danger: (territoryId: TerritoryId, defence: number) => number;
  /** The army's defence value (M12) at the start of the turn. */
  readonly defenceOf: (unit: UnitState) => number;
  /**
   * For a territory another faction controls: the defence its armies next door could bring
   * by moving in this turn, which they may do without a fight (M11). Undefined when none can.
   */
  readonly relief: (territoryId: TerritoryId) => Relief | undefined;
  /** Whether the territory is one of the faction's objectives. */
  readonly isObjective: (territoryId: TerritoryId) => boolean;
  /** What holding the territory is worth to the faction. */
  readonly stake: (territoryId: TerritoryId) => number;
}

/** Armies that could move into a faction's own empty territory to defend it. */
export interface Relief {
  readonly defence: number;
  readonly factionId: FactionId;
}

interface Pressure {
  /** Summed attack values of the faction's armies able to attack the territory. */
  readonly attack: number;
  /** Summed defence values of its armies next to the territory, all of which could move in. */
  readonly defence: number;
  /** Whether any of its armies could enter the territory if it stood empty. */
  readonly reaches: boolean;
}

export function assess(scenario: Scenario, state: GameState, factionId: FactionId): Assessment {
  const objectives = new Set<TerritoryId>(requireFaction(scenario, factionId).objectiveTerritoryIds);
  const hostile = Object.values(state.units).filter((unit) => unit.factionId !== factionId);
  const attackValues = new Map<UnitId, number>();
  const defenceValues = new Map<UnitId, number>();
  const stakes = new Map<TerritoryId, number>();
  const pressures = new Map<TerritoryId, ReadonlyMap<FactionId, Pressure>>();
  const dangers = new Map<string, number>();

  const attackOf = (unit: UnitState): number => cached(attackValues, unit.id, () => armyValue(scenario, unit, "attack"));
  const defenceOf = (unit: UnitState): number => cached(defenceValues, unit.id, () => armyValue(scenario, unit, "defence"));

  const pressureOn = (territoryId: TerritoryId): ReadonlyMap<FactionId, Pressure> => cached(pressures, territoryId, () => {
    const reach = new Set([territoryId, ...neighborsOf(scenario, territoryId).map((neighbor) => neighbor.territoryId)]);
    const byFaction = new Map<FactionId, Pressure>();
    for (const unit of hostile) {
      if (!reach.has(unit.territoryId)) continue;
      const before = byFaction.get(unit.factionId) ?? { attack: 0, defence: 0, reaches: false };
      // M23: a demoralized army cannot attack, but it may still enter an empty territory.
      byFaction.set(unit.factionId, {
        attack: before.attack + (unit.morale.demoralized ? 0 : attackOf(unit)),
        defence: before.defence + (unit.territoryId === territoryId ? 0 : defenceOf(unit)),
        reaches: true
      });
    }
    return byFaction;
  });

  const danger = (territoryId: TerritoryId, defence: number): number => cached(dangers, `${territoryId}|${String(defence)}`, () => {
    const pressure = [...pressureOn(territoryId)];
    if (defence <= 0) {
      return pressure.some(([, entry]) => entry.reaches) ? 1 : 0;
    }
    let worst = 0;
    for (const [attackerFactionId, entry] of pressure) {
      if (entry.attack <= 0) continue;
      const modifiers = situationalModifiers(scenario, state, {
        attackerFactionId,
        defenderFactionIds: [factionId],
        diggingIn: true,
        territoryId
      });
      worst = Math.max(worst, battleOdds(scenario.combat, entry.attack, defence, modifiers).takeChance);
    }
    return worst;
  });

  const alarms = new Map(victoryProgress(scenario, state)
    .filter((entry) => entry.factionId !== factionId)
    .map((entry) => {
      // A territory taken often brings two victory cities with it.
      const gap = Math.min(entry.territoryThreshold - entry.territoriesControlled, Math.ceil((entry.cityThreshold - entry.citiesControlled) / 2));
      return [entry.factionId, Math.max(0, victoryAlarm.steps - gap) * victoryAlarm.perStep] as const;
    }));
  const alarmFor = (territoryId: TerritoryId): number => {
    const control = state.control[territoryId];
    if (control?.kind !== "controlled") return 0;
    return control.factionId === factionId ? Math.max(0, ...alarms.values()) : alarms.get(control.factionId) ?? 0;
  };

  const stake = (territoryId: TerritoryId): number => cached(stakes, territoryId, () => {
    const cities = citiesIn(scenario, territoryId).filter((city) => city.countsForVictory).length;
    const base = (requireTerritory(scenario, territoryId).countsForVictory ? stakeWeights.territory : 0)
      + cities * stakeWeights.city
      + (objectives.has(territoryId) ? stakeWeights.objective : 0);
    return base * (1 + alarmFor(territoryId));
  });

  const relief = (territoryId: TerritoryId): Relief | undefined => {
    const control = state.control[territoryId];
    if (control?.kind !== "controlled" || control.factionId === factionId) return undefined;
    const defence = pressureOn(territoryId).get(control.factionId)?.defence ?? 0;
    return defence > 0 ? { defence, factionId: control.factionId } : undefined;
  };

  return { attackOf, danger, defenceOf, factionId, isObjective: (territoryId) => objectives.has(territoryId), relief, stake };
}

function cached<Key, Value>(cache: Map<Key, Value>, key: Key, compute: () => Value): Value {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = compute();
  cache.set(key, value);
  return value;
}
